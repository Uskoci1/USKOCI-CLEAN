# Preservation matrix — every RULE / CONDITIONAL sentence of the current AGENTS.md and where it lives in `AGENTS.proposed.md`

Source: `AGENTS.md` at `934057d5` (sha256 `a29c91b2…`, 159 blocks; block numbers as in `CLASSIFICATION.md`). Destination ids are the section/item numbers of `AGENTS.proposed.md` (`§3.1.2` = section 3.1, item 2). `SUPERSEDED:` rows name the later block that replaced the sentence and where that replacement lives; they are still traceable, nothing is dropped without a destination.

| Id | Block | Sentence (exact) | Destination |
|---|---|---|---|
| R001 | 1a | "the owner handed the P6 closing from Codex to the local Claude session through Codex's continuation command, and ordered work by the operational master plan until everything is resolved, verified, cleaned up and optimized, using the Android EMULATOR for testing (never the phone)." | §3.2.1 (emulator quote) + §4.1 (P6 order; successor cites "until everything is resolved, verified, cleaned up and optimized") + §1.3.2 (work by the LIVE plan) |
| R002 | 1b | "P6 stays OPEN; the 30k SQL screening is GREEN at 67ffd458 (run 36632921473) and is not re-opened; the frozen rollout ce1dab6b… does not yet contain the visibility/PLACES cost layers." | §4.1 (verbatim) |
| R003 | 1c | "Order: disposable PKG045b + frozen P6 + cost layers + x86_64 proof APK on a CI-hosted emulator (FULL→detail→Back, scroll/viewport/selected pin, memory/ANR) → controlled DEV rollout/cutover ONLY with the package-specific owner authorization (stop and report at that gate) → then write P6 ZAVRŠEN and STOP for the owner." | §4.1 (verbatim) |
| R004 | 1d | "One P6 writer at a time: fetch before touching P6 files." | §4.1 (verbatim) |
| R005 | 1e | "The operational plan lives at docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html (README beside it)." | §1.3.2 (verbatim) |
| R006 | 1e | "After each closed package run `node scripts/control/osvezi-master-plan.mjs --html docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html --redovi docs/control/redovi.json --state docs/control/master-plan-live-state.json` and then the same command with --check; docs/control/redovi.json stays the ONLY status registry, the HTML is a projection." | §2.1 (verbatim) |
| R007 | 1f | "No new audit, no P7, no new prototype." | §4.1 (verbatim, with end events) |
| R008 | 11 | "continue P6 only; do not advance to another large phase. Declare P6 ZAVRŠEN only after all applicable performance, four-mode, paging/fencing, production reader/map/list/FULL-return, rollout and exact native/memory/ANR gates close; then STOP for owner instruction." | §4.1 (verbatim) |
| R009 | 19 | "Keep docs/control/redovi.json as the sole tracker." | §2.1 (verbatim) |
| R010 | 19 | "read docs/implementation/product-v1-closure-20260926/FINAL_PRODUCT_EXECUTION_RUNBOOK_20260928.md for the detailed continuation contract, P0–P7 implementation/exit criteria, all62 control-row coverage, deep UI states, performance budgets, cleanup, exact evidence and store/rollout gates." | §1.3.3 (verbatim) |
| R011 | 20 | "the owner explicitly defers the two Sep27 privacy branches (AI context minimization d18e830a and processor inventory 1ab01e78) to the final whole-app privacy pass before public release. Keep them recorded as NOT INTEGRATED / NOT APPLIED; do not start their integration now." | §4.2 (verbatim) |
| R012 | 20 | "This changes scheduling only, not the application scope or status of already applied packages." | §4.2 (verbatim) |
| R013 | 22 | "native candidate2b2cf4d7 REJECTED after repeated AndroidANR" … "Never install rejected2b2 phone APK36355441615." | §3.2.5 (verbatim) |
| R014 | 25 | "Catalog27 resources reviewed/NOT imported/native playback unproved; matching stills required, no global FactArt/Lottie replacement." | §3.2.5 (verbatim) |
| R015 | 32 | "Missing field must not become an empty array." | §3.4.3 (verbatim) |
| R016 | 42 | "owner now explicitly authorizes consolidated emulator build/install/check; historical native deferral is superseded for this checkpoint." | §3.2.2 (quoted) |
| R017 | 42 | "Ordinary source approval does not authorize pending server packages." | §3.1.2 (verbatim) |
| R018 | 49 | "Normal UI refinements are authorized; no blanket server/Edge/payment/certificate permission." | §3.1.2 (verbatim) |
| R019 | 50 | "Normal UI/flow work no longer requires per-image approval; TaskCard/DiscoveryPeek remain unchanged." | §3.6.7 (verbatim) |
| R020 | 50 | "Server/Edge/certificate application still requires explicit `primeni`; dependency approval remains separate." | §3.1.2 (verbatim) |
| R021 | 50 | "do not assert private access." | §2.5 (verbatim) |
| R022 | 50 | "Preserve the same 62 rows and all older evidence below as history." | §2.2 (verbatim) |
| R023 | 51 | "latest owner instruction authorizes normal UI/flow refinement without individual proposals and requests critical review every round." | §3.2.2 ("requests critical review every round") + §3.6.7 (no per-image approval, via R019) |
| R024 | 51 | "No dependency, DEV, Edge, certificate or payment changes are authorized by general UI approval." | §3.1.2 (verbatim) |
| R025 | 51 | "Older proposal-per-screen wording below is historical and superseded." | Implemented: the superseded wording (R030b, R092) is not carried; recorded in CLASSIFICATION.md §3 X3 |
| R026 | 52 | "Exactly expo-blur57.0.3 was explicitly approved and added" | §3.1.5 (verbatim) |
| R027 | 52 | "Do not use the mockup or source review as native acceptance." | §3.2.4 (verbatim) |
| R028 | 54 | "Related server candidates under `supabase/candidates/` are NOT APPLIED and do not authorize deployment." | §3.1.2 (verbatim) |
| R029 | 56a | "latest owner order is P0 publication → P1 Discovery → P2 connected work → P3 chat/voice → P4 same-message push → P5 AI/matching → P6 growth → P7 account/release." | §1.3.3 (verbatim) |
| R030a | 56c | "never label unverified code READY." | §3.2.4 (verbatim) |
| R030b | 56b / 56c first half | "Appearance/user-flow changes require a concrete image proposal and owner approval before implementation." / "Tests/builds/installs/device acceptance run only when the owner asks" | SUPERSEDED: by block 51 (§3.2.2, §3.6.7) and by blocks 42 / 95 / 1a (§3.2.1, §3.2.2); CLASSIFICATION.md §3 X3, X4 |
| R031 | 56d | "One living62-row matrix: `docs/control/redovi.json` → generated `FINALIZATION_MATRIX.md`." | §2.2 (verbatim) |
| R032 | 56e | "Owner correction: change ONLY the pin now (white capsule, orange selected halo/label,6% enlargement), retain the existing card exactly." | §3.6.7 (verbatim) |
| R033 | 56f | "Never use the rejected concept card as the implementation reference." | §3.6.7 (verbatim) |
| R034 | 63 | "read `docs/implementation/product-v1-closure-20260926/PLAN.md` first for new product work." | §1.3.3 (quoted) |
| R035 | 63 | "Voice messages are mandatory V1 Chat 2.0." | §3.5.1 (verbatim) |
| R036 | 63 | "AI taxonomy uses stable canonical nodes + candidate promotion; one odd Need never auto-creates a category." | §3.5.1 (verbatim) |
| R037 | 63 | "Matching is hard eligibility then ranking." | §3.5.1 (verbatim) |
| R038 | 63 | "Growth projections are required before scale." | §3.5.1 (verbatim) |
| R039 | 63 | "Notification copy/metadata contract is in the sibling `NOTIFICATION_MATRIX.md`." | §3.5.1 (verbatim) |
| R040 | 68 | "Do not globally enable sending; use the documented zero-device backlog retirement then one-owner-device/one-event proof only after approval." | §3.1.7 (verbatim) |
| R041 | 68 | "read `docs/implementation/release-hardening-20260926/MEDIA_PUSH_PREFLIGHT.md` and `CODEX_HANDOFF.md` before touching media or push." | §1.3.8 |
| R042 | 74 | "Owner authorized one real DEV test task, necessary text AI calls and a smartphone equipment addition; native flow passed through both saved ratings. That paid-AI allowance is fulfilled." | §3.1.6 (verbatim) |
| R043 | 75 | "Keep the single control tracker; do not restart completed work, introduce dependencies or deploy server changes from research alone." | §2.1 (verbatim) |
| R044 | 79 | "The owner rejects identical-looking task cards, task details and Agreements." | §3.6.5 (verbatim) |
| R045 | 79 | "Preserve actual facts, commands, recovery, ordinary type sizes and white surfaces. This supersedes old rules forcing one card outline." | §3.6.5 (verbatim) |
| R046 | 79 | "Ordinary text remains the design baseline; the narrow view is a separate resilience check." | §3.6.5 (verbatim) |
| R047 | 80 | "The owner's latest direction is stronger readable type, without enlarging normal letters or prices." | §3.6.5 (verbatim) |
| R048 | 80 | "Preserve all actual facts/commands/recovery, white surfaces and existing fluid motion." | §3.6.5 (verbatim) |
| R049 | 80 | "Keep coherent batches, not an APK for every small style edit." | §3.2.3 (verbatim) |
| R050 | 81 | "The owner permits creative recomposition: old visual recipes must not force generic or cramped UI. Keep R12's clean white reading surfaces, real facts and existing domain/recovery/privacy guards." | §3.6.5 (verbatim) |
| R051 | 81 | "Preserve larger coherent batches." | §3.2.3 (verbatim) |
| R052 | 81 | "Owner typography refinement: judge composition at ordinary system text size. Enlarged-text inspection is a bounded resilience check, not the visual baseline; do not inflate ordinary titles or prices to accommodate that check." | §3.6.5 (verbatim) |
| R053 | 82 | "the owner's latest explicit correction rejects mint backgrounds and pale large panels." | §3.6.5 (verbatim) |
| R054 | 82 | "White reading surfaces, neutral control wells/rules/shadows; color comes from icons, words, photos and clear actions. This supersedes the R8 mint-canvas and historical ivory prescriptions below." | §3.6.5 (verbatim) |
| R055 | 82 | "Geographic parks and water, meaningful warning states and colored artwork remain." | §3.6.5 (verbatim) |
| R056 | 82 | "Checks, APK and bounded native observations must be read from this batch's evidence, never inferred from a palette change." | §3.2.4 (verbatim) |
| R057 | 86 | "Do not equate text voice mode with spoken AI answers." | §3.5.4 (verbatim) |
| R058 | 86 | "Historical R8 direction was superseded by R12: white canvas and reading groups, neutral shadows, no mint wash." | Implemented: R12 carried in §3.6.5; the R8 mint direction is not carried |
| R059 | 87 | "Owner now wants larger coherent batches before APK/device verification, not a new build for every small edit." | §3.2.3 (verbatim) |
| R060 | 87 | "Normal soft/fluid motion stays enabled; Reduce Motion is the individual's system preference." | §3.6.7 (verbatim) |
| R061 | 90a | "V41 HTML is the direction for the look, not a new layout ("velika dugmad ostaju, ovo su samo usmerenja"); the forensic UI/UX analysis doc is the rulebook. Početna keeps its two big tiles;" | §3.6.3 (verbatim) |
| R062 | 90b | "one ORANGE primary per screen, every other action white with a green label." | SUPERSEDED: by block 96 ("The PRIMARY ACTION IS NOW GREEN … Do not switch it back from the doc alone.") — §3.6.4 records the supersession; CLASSIFICATION.md §3 X1 |
| R063 | 92 | "one agent per checkout." | §3.3.3 (verbatim) |
| R064 | 94 | "read `USKOCI_MASTER_PLAN_DIZAJNA.md` first for all UI/UX work." | §1.3.5 (verbatim) |
| R065 | 94 | "Work branch: `work/uskoci-ui-unification-20260924`." | §3.3.1 (verbatim) |
| R066 | 95 | "Act as the whole senior product team and decide everything except: real payments, prices, payment provider, Google Maps/API billing, external accounts or keys, legal/privacy decisions, a permission with serious privacy consequences, destructive production migrations or data deletion, the core business model, a store/production release." | §3.1.1 (verbatim) |
| R067 | 95 | "QA device is the Android EMULATOR (AVD USKOCI_V5_TEST, build target `emulator`), not the phone." | §3.2.1 (verbatim) |
| R068 | 95 | "Every screen: implement → types/tests → build → emulator screenshot → separate UX and VISUAL critique → fix → screenshot, until finished." | §3.2.2 (verbatim) |
| R069 | 95 | "LOCKED IA (plan in the Claude Doc tab "Plan ekrana (23. sep)" of https://claude.ai/code/artifact/4e3c1c50-fa0b-48a7-b998-454e0b8b6923; sketches https://claude.ai/artifact/B2YMSAQVPz7iuq6TXHgZLf): tabs Početna (overview: tiles, Čeka te, next Dogovor, Moji zadaci and Moje prijave rows) \| Zadaci (other people's tasks: map and list as ONE screen with a draggable list sheet) \| Dogovori; Moje aktivnosti retired; /mapa and /prilike redirect to /zadaci." | §3.6.6 (verbatim) |
| R070 | 95 | "The AI chat's reference look is the Gemini app (pill composer, voice mode; memory: uskoci-ai-chat-reference-gemini)." | §3.6.6 (verbatim) |
| R071 | 95 | "CI proofs that start the full local Supabase retry the start on registry throttling (25dc016a)." | §3.2.7 (verbatim) |
| R072 | 96 | "The PRIMARY ACTION IS NOW GREEN with a white label (V28 and V41 both draw it so; `brandAction` + `sys.color.onGreen`); orange stays an accent only (Home publish tile, what waits, map "+"). Do not switch it back from the doc alone." | §3.6.4 (verbatim) |
| R073 | 96 | "one `vreme()` time format (src/lib/vreme.ts: "24. sep · 12:00", year only when not current, never seconds); FactArt as the one icon system for every fact (12 new kinds); one card look (`card`/`cardCompact` with V28's TaskCard shadow, `inset` for notes, no card inside a card); one voice without grammatical gender (Tražiš pomoć / Uskačeš, Posao je gotov, Mogu odmah); one command vocabulary; no "server" wording; notification settings in plain Serbian; one `field` token and pill chips." | §3.6.4 (verbatim) + §3.6.8 (language items repeated) |
| R074 | 96 | "OWNER RULE, 2026-09-23 late: V28/V41/V46 HTML is product documentation (functions, content, logic, data, flows), NOT design authority. For every screen ask whether a premium USKOČI built from zero would organise it this way; if not, recompose it from scratch. Keep function and flow, not the old look" | §3.6.1 (verbatim) |
| R075 | 96 | "Step G.0 (c89b7223): the bottom bar only on the three roots (Početna, Mapa, Dogovori)" | §3.6.6 ("the bottom bar only on the three roots", roots per block 95 — CLASSIFICATION.md §3 X5) |
| R076 | 96 | "no screen is done before the phone screenshot loop." / "key screens loop redesign → phone screenshot → critique → redesign." | SUPERSEDED: by blocks 95 and 1a (§3.2.1 emulator); CLASSIFICATION.md §3 X2 |
| R077 | 97 | "The owner explicitly permits parallel agents now; use bounded scopes and one writer per file." | §3.3.3 (verbatim) |
| R078 | 97 | "no auth bypass, paid provider probe or real business mutation is implied." | §3.1.6 (verbatim) |
| R079 | 99 | "control rows remain the sole execution tracker." | §2.1 (verbatim) |
| R080 | 99 | "generation alone is not publication." | §2.5 (verbatim) |
| R081 | 100 | "Keep other authors' control README/template changes and the forbidden untracked migration out of your commits unless ownership is explicitly transferred." | §3.3.4 (verbatim) |
| R082 | 101 | "Do not bypass sign-in." | §3.3.5 (verbatim) |
| R083 | 104 | "`docs/control/` is the one living table from UX blueprint to phone (62 rows, six lights, blockers, store gates, two-phone test). After every piece of work: refresh `dev_snapshot.json` if DEV changed, edit `redovi.json`, run `node scripts/control/osvezi.mjs`, commit, and republish `docs/control/out/tabla.html` to https://claude.ai/artifact/VxTvL3VpwhYv8cxJCWzD5t. Telefon is green only with phone evidence for the current build. See `docs/control/README.md`." | §2.3 (verbatim) + §3.2.1 (Telefon sentence repeated) |
| R084 | 105 | "read docs/implementation/v5-ai-first/UX_NACRT_20260922.md before each screen." | §1.3.5 (verbatim) |
| R085 | 105 | "Every audit row must record agreement, missing capability and proposed deviation from that draft. Disclose differences before implementation" | §2.4 (verbatim) |
| R086 | 105 | "complete and show the whole-app functional screen matrix before further implementation. New screens wait for approval of the analysis." | SUPERSEDED: by block 103 ("This supersedes the analysis waiting gate below"); nothing to carry |
| R087 | 106 | "read docs/implementation/OWNER_DESIGN_DIRECTION_20260922.md before each screen." | §1.3.5 (verbatim) |
| R088 | 106 | "Inter/colors/FactArt/TaskCard are the foundation, V28 is a starting point with design freedom. Green titles are explicitly welcomed; the preceding dark-title instruction was withdrawn." | §3.6.1 (verbatim) |
| R089 | 106 | "Claude's independent screen review is required, not presumed complete." | §3.2.2 (verbatim) |
| R090 | 106 | "Only @gorhom/bottom-sheet5.2.14 is newly approved; no blanket package or backend-change approval." | §3.1.5 (verbatim) |
| R091 | 106 | "Package approval 2026-09-23 (owner "Da" to the explicit ask): `lottie-react-native` ~7.3.8, installed with `expo install`, for characters and moments only (AI assistant states, "Dogovoreno!", empty states), never buttons or facts; wrapper `src/ui/system/LottieArt.tsx` enforces reduced motion (first frame) and spoken-or-silent accessibility. `expo-speech` (a narrator) was asked for separately and is NOT approved. The owner's Lottie files (V28) are awaited; none is bundled yet." | §3.1.5 (verbatim) + §3.6.7 (usage constraint repeated) |
| R092 | 106 | "Work one screen at a time, show it with one sentence of rationale, prove types/tests, build and verify on the phone." | PARTLY SUPERSEDED: "show it" by block 51 (§3.2.2/§3.6.7); "on the phone" by blocks 95/1a (§3.2.1); "prove types/tests, build and verify" lives in the §3.2.2 loop |
| R093 | 108 | "do not revert to the old native visuals or generic icons." | §3.6.4 (verbatim) |
| R094 | 108 | "preserve the supplied V28 HTML's colored illustrated icons, palette, clean legibility and inset bottom-navigation character. Improve density using V31 as a comparison" | SUPERSEDED: by blocks 109 (§3.6.1), 96 (§3.6.1, §3.6.4 FactArt) and 82 (§3.6.5); CLASSIFICATION.md §3 X6 |
| R095 | 109 | "**Non-negotiable:** server, guards and recovery stay; no invented data; text no smaller than 12 px; a missing price never looks like an amount; the bottom navigation always shows where you are; tests pass; new packages need the owner's approval." | §3.6.2 (verbatim) + §3.4.3 + §3.1.5 |
| R096 | 109 | "**V28, the slice-1 foundation and the V28 reference screens** (`docs/implementation/v5-ai-first/v28-reference/`) are the starting point and inspiration, not a lock." | §3.6.1 (verbatim) |
| R097 | 114 | "Owner rules recorded there and applied: no eyebrow and no copy explaining where you are (inner bar = arrow + title-of-content), one orange action per screen with the reason beside a grey one, "stalno / ponekad / retko" placement, hold-to-talk SENDS on release (accessible mode keeps review)." | §3.6.3 (quoted; the colour word "orange" of the primary is superseded by block 96, §3.6.4; CLASSIFICATION.md §3 X1) |
| R098 | 116 | "Report and block are keyed by the account because a person shows two faces; the owner decided on 2026-09-22 that this id may be disclosed for safety, the same disclosure a Dogovor already makes." | §3.4.4 (verbatim) |
| R099 | 119 | "IMPORTANT: table ACLs are in closure_erasure_program_digest_v5(), so B includes an isolated recertification and requires explicit owner approval AND compatible APK rollout." | §3.1.4 (verbatim) |
| R100 | 119 | "On 2026-09-22 the owner explicitly approved pkg045b and the internal certificate update AFTER verification of the new app. That approval is granted; do not ask for it again. B remains ON HOLD for phone readiness and verified rollout." | §4.3 (verbatim, with end event) |
| R101 | 119 | "approval does not imply that the device verification condition has been met." | §3.1.4 (verbatim) |
| R102 | 120 | "do not overwrite a contextual ASK for a genuinely missing field with a canned question. Preserve known-field retargeting and all fact/ambiguity/ownership guards." | §3.5.3 (verbatim) |
| R103 | 120 | "Owner confirmed improved dialogue and asked for warmer, slightly longer replies with occasional emojis." | §3.5.3 (quoted) |
| R104 | 126 | "See the report before changing prompts or claiming the conversation is complete." | §1.3.8 (verbatim) |
| R105 | 126 | "Do not copy raw conversations into the repository." | §3.4.2 (verbatim) |
| R106 | 133 | "the supplied HTML is a starting direction, NOT a final design or pixel lock. Refine hierarchy, layout, components, states and motion using product judgment; preserve original brand/entry assets and actual business semantics." | §3.6.1 (verbatim) |
| R107 | 133 | "Skills are implementation guidance; they do not override the owner's latest visual direction." | §3.6.1 (verbatim) |
| R108 | 134 | "The owner chose to merge and record rather than take a new dependency." | §3.1.5 (verbatim) |
| R109 | 134 | "This accepts those six alerts for that cause; a new alert is a new decision." | §3.1.5 (verbatim) |
| R110 | 136 | "`pkg031a`: the requester cannot cancel after the worker says done (7.16)." | §3.5.2 |
| R111 | 136 | "agreed times in Serbian time with "po vremenu u Srbiji" (8.27);" | §3.5.2 + §3.6.8 |
| R112 | 136 | "no category shown to people;" | §3.5.2 |
| R113 | 136 | "sign-up says the legal documents are not published yet, instead of a tick that recorded nothing (8.2);" | §3.5.2 + §3.4.5 |
| R114 | 136 | "no "Izmene i otkazivanje" for the requester after done." | §3.5.2 |
| R115 | 140 | "**Temporary:** `pkg029e` puts the owner's accounts in the TEST world while testing. Take it out before real users." | §4.4 (verbatim) |
| R116 | 142 | "`pkg027c`: notifications use "ti", including the stored ones;" | §3.6.8 |
| R117 | 142 | "`pkg027d`: no invented profile headline or bio;" | §3.4.3 |
| R118 | 147 | "Other DEV migrations still need a separate explicit owner decision; the older general AF-D26 authorization below does not override that newer boundary. **No pkg023c activation is authorized.**" | §3.1.2 (verbatim) |
| R119 | 152 | "latest AF-D26 authorizes verified backend promotion on canonical DEV/ALPHA `leqcwgzvjsxugfgzdmth` for the connected private APK. Do not create extra staging or reset donor labs. A distinct future production project remains outside this authorization." | §3.1.3 (verbatim) + §3.3.5 |
| R120 | 152 | "The existing CLEAN authority, integration branch and private boundaries remain. AF-D26 authorizes verified canonical DEV/ALPHA changes; the separate production gate remains." | §3.1.3 (verbatim) |
| R121 | 153 | "read `docs/implementation/v5-ai-first/DESIGN_SKILLS.md` and apply its nine locally installed design/native skills to relevant USKOČI work. User/V5 decisions win over skill examples; preserve the original entry/mascot/motion/HOME." | §1.3.5 (verbatim) + §3.6.1 |
| R122 | 154 | "This is an existing Expo/React Native marketplace with Supabase authority. Do not restart it or create another product master." | §1.2 (verbatim) |
| R123 | 155 | "Read in this order:" | §1.3 |
| R124 | 156.1 | "`docs/authority/AUTHORITY_INDEX.md`: newest owner commands, final21/21 review, complete50-row reconciliation and explicit supersessions." | §1.3.1 (verbatim) |
| R125 | 156.1 | "Latest explicit owner decision wins. Never turn a historical proposal into approval." | §1.1 (verbatim) |
| R126 | 156.2 | "`HANDOFF.md`, the top checkpoints of `docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md`, `CURRENT_IMPLEMENTATION_STATUS.md`, `IMPLEMENTATION_CONTINUITY.md`, then the linked latest `NEXT_AI_HANDOFF_*.md` and `NEXT_AI_HANDOFF_MANIFEST.json`." | §1.3.9 (as HISTORICAL-bannered history pointers) |
| R127 | 156.2 | "Physically read Git/CI/live metadata; actual newer state wins implementation facts." | §1.4 (verbatim) |
| R128 | 156.3 | "Product/architecture sources named in the authority index. CLEAN/Supabase owns business rules; keep existing RPC/RLS/revision/idempotency boundaries." | §1.3.6 (verbatim) |
| R129 | 156.4 | "Active V5 visual authority is the supplied sibling `USKOCI_V5_AI_FIRST_PAKET/07_REFERENCA/USKOCI_SPOJ_V4_9_COMPOSITION.html`, preserved in `01_HTML/USKOCI_V5_AI_FIRST.html`, together with the full V5 command." | §3.6.1 (scoped to the entry composition; screen authority = later owner direction; CLASSIFICATION.md §3 X6) |
| R130 | 156.4 | "Preserve its entry composition, original photographs/SVG notes, mascot, timing and HOME signature. The older repository SPOJ V2/referenceEntry donors do not override V4.9. Use true RN/SVG and original assets, without a WebView or the HTML demo runtime." | §3.6.1 (verbatim) |
| R131 | 156.4 | "See `docs/implementation/v5-ai-first/NATIVE_CHECKPOINT138_REVIEW.md` for the discovered older native composition and the pending V4.9 correction." | §5 (pointer) |
| R132 | 156.5 | "Legal/policy sources, the supplied RC2 package and current V5 owner decisions. RC2 content has been received; AF-D22 supersedes the old retention proposal. Follow the documented adaptation and exact executable readiness, without inventing operator details, legal certification or retention periods. Old missing-package requests are historical." | §1.3.7 (verbatim) + §3.4.5 |
| R133 | 156.6 | "`docs/authority/sources/closure-plan/USKOCI_RADNI_PAKETI.json` and current owner execution command: W03–W13 scope, current cursor and parent flows. Old package physical status is historical." | §1.3.9 (pointer) |
| R134 | 156.7 | "Existing proof/evidence only for the affected risk; exact run/source scope matters." | §1.4 (verbatim) |
| R135 | 157 | "Root is the sole integrator/live writer." | §3.3.3 (verbatim) |
| R136 | 157 | "Isolate subagent file ownership." | §3.3.3 (verbatim) |
| R137 | 157 | "Reuse existing code." | §3.3.3 (verbatim) |
| R138 | 157 | "Targeted checks during development; full regression/migration/security/CodeQL/device gates at major integration, complete vertical journey or release candidate." | §3.2.3 (verbatim) |
| R139 | 157 | "No secrets in client/repository/logs/tests." | §3.4.1 (verbatim) |
| R140 | 157 | "Do not request passwords/JWT." | §3.4.1 (verbatim) |
| R141 | 158 | "Migrations are forward-only; never rewrite an applied migration." | §3.3.2 (verbatim) |
| R142 | 158 | "Keep quarantine branch `repair/ru0-ru1-backend-20260902` isolated: never merge, cherry-pick or apply it." | §3.3.2 (verbatim) |
| R143 | 158 | "Preserve existing Auth/RLS/concurrency and controlled live preflight/postflight gates." | §3.3.2 (verbatim) |
| R144 | 159 | "The earlier owner SAFE STOP is superseded by the active V5 resume and AF-D26 promotion decision above." | §6 (verbatim) |
| R145 | 159 | "The previous long AGENTS is preserved, **HISTORICAL**, at `docs/authority/history/AGENTS_PRE_HANDOFF_20260911.md`. It is not the active reading order or cursor." | §6 (verbatim) |

## Pointer sentences (class POINTER; mapped although not counted as rules)

| Block | Sentence | Destination |
|---|---|---|
| 45 | "# USKOČI — repository entry map" | title of `AGENTS.proposed.md` |
| 112 | "Current status index: `docs/implementation/USKOCI_CURRENT_STATUS.md`. … the index separates implemented/proved/applied/built/device-verified states and points out older snapshots." | §5 (older indexes) |
| 113 | "It grants no new permissions or product decisions." (`APP_FINISHING_PLAN_20260922.md`) | §3.1.2 + §5 |
| 118 | "The snapshot supplies analysis; the lights stay computed. See `docs/control/README.md`." | §2.3 |
| 132 | "the exact method for a DEV change" (`NEXT_AI_HANDOFF_20260921_2145.md`) | §1.3.9 |
| 139 / 150 | PKG-030 contract pointer; historical 2026-09-19 handoff | §5 (round documents) / §1.3.9 |
| 151 | "read `docs/implementation/execution/CURRENT_ENTRY_MAP_20260916.md` first. It names the one current authority chain (reconciliation, Execution Ledger, owner decisions, PKG-011B design system) and marks every older checkpoint historical." | §1.3.4 (verbatim; the literal `CURRENT_ENTRY_MAP_20260916.md` is required by `scripts/ci/pkg012-source-authority.test.cjs`) |
| 156.6 | W03–W13 pointer | §1.3.9 |

## Recurring imperatives from STATE blocks (absorbed, see CLASSIFICATION.md §2)

| Ids | Sentences | Destination |
|---|---|---|
| E1 | "do not infer device success from source" (58); "do not mark Discovery complete" (59); "do not infer deployment from Git" (61); "do not call it fluid or server-load proof" (69); "do not infer native success from tests" (70); "Do not infer native or store acceptance from passing mocks." (72); "Whole-app, phone and store acceptance must come from the exact later receipt, never from this entry." (73); "Do not claim complete Home pagination, fewer preview fetches, release readiness or device verification from this package." (122); "Do not mark the whole semantic audit closed." (125); "check its actual result before claiming an APK exists" (130); "do not claim it was separately measured afterward" (131) | §3.2.4 (general sentence with the block list) |
| E2 | "local generation is not publication" (37, 44, 46, 48) | §2.5 |
| E3 | "Keep historical failed APK evidence and exact source distinctions." (71) | §3.2.5 (verbatim) |
| E5 | "each byte-identical to its file" (142); "byte-identical on readback" (143, 146); "All four are byte-identical on readback." (138) | §3.2.6 |
| B | "Preserve larger implementation batches." (83); "Preserve the owner's larger-batch working preference." (84) | §3.2.3 |
| — | "its remaining steps are the owner's (package name, which is permanent in Play Console; EAS `production` environment variables; Play Console app, listing and privacy URL)" (89) | §3.1.1 |

## Count check

| | Count |
|---|---|
| RULE / CONDITIONAL sentence rows (R001–R145, with R030 split into R030a/R030b) | **146** |
| … of which mapped to a section of `AGENTS.proposed.md` | 138 |
| … of which SUPERSEDED with the superseding block and its destination named (R030b, R062, R076, R086, R094) | 5 |
| … of which PARTLY SUPERSEDED with both halves placed (R092) | 1 |
| … of which supersession notes implemented by omission of the superseded text (R025, R058) | 2 |
| Rows without a destination | **0** |
| CONDITIONAL sentences (R002, R003, R004, R007, R008, R011, R012, R100, R115) | 9 — all in §4 with an end event |
| Owner-quoted Serbian words preserved verbatim | "velika dugmad ostaju, ovo su samo usmerenja" (R061); "ovaj sistem ikona … kroz ceo app … izgled kartice isti" and "nije ove boje … loš fazon" (block 96 heading, kept in CLASSIFICATION.md; the resulting rule R072 is in §3.6.4); "Da" (R091); "po vremenu u Srbiji" (R111); "stalno / ponekad / retko", "Dogovoreno!", "Tražiš pomoć / Uskačeš, Posao je gotov, Mogu odmah" (R073, R091, R097); "primeni" (R020); "odobravam sve"/"dozvoljavam sve"/"kreni"/"odobram sve to" are STATE (approval records of applied packages, archived) |

Note on one sentence deliberately **not** promoted to a rule: "Serbian Latin script" is a rule of the local agent memory (`uskoci-design-session-rules`), not of AGENTS.md; it is therefore not in the proposal (nothing is invented). The language rules that ARE in AGENTS.md (R073, R111, R116) are all carried in §3.6.8.
