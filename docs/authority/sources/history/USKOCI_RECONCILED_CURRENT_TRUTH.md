# USKOČI — Reconciled Current Truth

**Audit date:** 2026-08-28  
**Scope:** supplied packages only; forensic reconciliation and HTML-reference planning  
**Mutation state:** **PRODUCTION UNTOUCHED · SOURCE UNTOUCHED · SUPABASE UNTOUCHED · NATIVE UNPROVEN · BACKEND UNPROVEN**

## 1. Executive determination

The supplied material supports a coherent target product, but it does **not** support a claim that the target is already physically implemented. The clean package is a donor/evidence checkpoint, the control package is the current product authority, the visual boards are art-direction evidence, and the HTML package is visual/interaction evidence. No one HTML file is cumulative for all current locks.

The build gate remains closed. The exact authorization phrase documented by the package is `APPROVED FOR CLEAN BUILD`; it was not given in this task. This audit therefore makes no source, migration, Supabase, production, native, or HTML implementation change.

The most important reconciliation is structural rather than cosmetic:

- Product truth is flow-first: Need → public projection → Application → selection → Dogovor → execution → completion → review/history.
- Requester navigation is **Početna | Potrebe | + | Dogovori | Profil**.
- Worker navigation is **Početna | Prijave | USKOČI mark → Prilike | Dogovori | Profil**.
- `Dostupan sam` is an important secondary control, not a primary tab.
- The historical 30-screen list has no clean `Prijave` screen. For the target control model, **W06 is reconciled to Prijave**; Availability/Calendar remains a secondary route/component from W01/W08. This is an information-architecture repair required by the higher navigation lock, not a new product preference.
- Dogovor has only two local tabs: **Pregled | Poruke**. Chronology is embedded; it is not a third `Tok` tab.
- AI suggestions never become system truth without human confirmation and canonical save.
- Exact/private location never leaks into public projection.
- Worker Applications are free. The Povezivanje entitlement is real, launch cost is zero, and paid checkout is off.
- Current HTML should be treated as donors: preserve accepted Entry/Auth, evolve useful V4 salience work and V1.3 Need/Marketplace work, and rebuild the stale navigation, cards, Dogovor composition, state catalog, and component system.

## 2. Physical package truth

All ZIP archives passed archive integrity checks and contained no path-traversal entries. Hashes below are SHA-256 of the received files.

| Package | Physical file | Size | SHA-256 | Verified role |
|---|---|---:|---|---|
| A | `USKOCI_CLEAN_CONTINUATION_FINAL_V2_2026-08-27(2).zip` | ~25 MB | `1b8bebfb0fe02a64df652a7ec503fb70c8a9507bd852f93061588dca9f915684` | Clean donor/evidence package; not build authority |
| B | `USKOCI_HANDOFF_02_CANON_CONTROL_CENTER_2026-08-28.zip` | ~1.9 MB | `17c1dbc6fcdc4b8990b8b6c44d7e23c213da4f9f601292e5f0cb7a64b2f1e1fc` | Current canon/control center |
| C | `USKOCI_HANDOFF_03_VISUAL_BOARDS_01_05_2026-08-28.zip` | ~13 MB | `e73f8bea58836cf437bd478083c0789fc586f1021c838d2cac4dd0858bc2fe68` | Visual boards 01–05 |
| D | `USKOCI_HANDOFF_04_VISUAL_BOARDS_06_10_2026-08-28.zip` | ~13 MB | `4fa67ba3622a3d9f9957c60b42cd3b1bc6dc520ef179c1a8ebf54d38b5ab35f4` | Visual boards 06–10 |
| E | `USKOCI_HANDOFF_05_HTML_WORKBENCH_2026-08-28.zip` | ~12 MB | `711f402a3e48cef0f8da93d5f78e57b0cf3573e3343c051d62baa485b966481b` | Current/historical HTML evidence |
| Command | `USKOCI_ULTRA_DEEP_RECONCILIATION_AND_HTML_MASTER_COMMAND_2026-08-28.md` | ~31 KB | `8224e8bdc25423f7cddd60c2d85177669b6edc4c942a4309705e7b3ce96305d9` | Audit instruction supplied by owner |

Extraction produced 1,932 files (~51.6 MB) in A, 52 files (~3.59 MB) in B, ten physical PNG boards across C/D, and 13 files in E.

### 2.1 Source anchor

The clean package contains no working `.git` directory. It contains the compact incremental bundle:

`PRAZAN/CLEAN_CONTINUATION_META/USKOCI_DELTA_b01fb06_to_49cd950.bundle`

- Bundle SHA-256: `76f388242249e57fa8d2950bc24772304822797b356fd4c4391d1886d72c9e0b`
- Physical advertised terminal object: `49cd950ea88729e4d3abaeceb28f325667e26082` as `HEAD`
- Documented repo/branch: `Uskoci1/uskoci`, `claude/rekonstrukcija-2026-08-24`
- Bundle verification against an empty repository stops at the documented missing prerequisite base object `b01fb06babeef5d758586be971d4f0f76ea654ef`.

Therefore:

- checkpoint object `49cd950…`: **SOURCE VERIFIED** as a bundle head;
- repository name and branch: **CURRENT_SOURCE_ONLY**, documented but not independently proven by a supplied `.git` graph;
- full ancestry, branch protection, remote status, dirty-worktree state: **RUNTIME_UNPROVEN**.

The package physically contains an active donor `src/` tree, `supabase/` material and reconstruction evidence. The expected target monorepo shells (`apps/uskoci-mobile`, `packages/*`, `legacy-reference`, `migration`, `reconstruction`, `supabase`) are partial/placeholders rather than a completed cutover. The donor root is evidence, not the final target dependency graph.

### 2.2 Required evidence presence

All documents explicitly required in phases 1–6 were found and read completely, including the authority map, decisions, final product specification, open decisions, state/flow/field/action/data matrices, navigation maps, screen book and matrix, closure queue, UI/UX and component systems, Dogovor UX, AI Need blueprint/closure, visual direction board, detailed AI/UI documents, all ten PNG boards, and the HTML workbench.

The following expected proof was **not** supplied:

- live Git remote/branch graph and working-tree status;
- live Supabase schema, policies, functions, queues, secrets, logs or production state;
- native simulator/device evidence for the target architecture;
- a standalone physical “Design Brain” routing package; only references to its intended specialist-routing behavior were found;
- external provider/legal/fiscal proof for paid enablement or exact retention durations;
- a fresh runnable local browser binary in this session.

## 3. Authority map

When claims conflict, the following order governs this audit:

1. **Latest explicit owner locks and same-day owner decisions**, provided they do not violate higher security/data authority.
2. **Current product canon:** `CURRENT_AUTHORITY_MAP_C12_38_D0154.md`, `105_PRODUCT_DECISION_REGISTER.md`, `112_FINAL_PRODUCT_SPECIFICATION.md`, `118_FUNCTIONAL_TRUTH_REAL_OPEN_DECISIONS.md`, current known-conflict ledger, owner locks and Engineering Operating Model.
3. **Canonical behavior contracts:** state machine, branch/field/binding/effect/resume/navigation/action/data contracts.
4. **Later screen/UI closure documents**, reconciled against levels 1–3.
5. **Physical source**, only for what currently exists and how it behaves; it cannot override target product truth.
6. **Verified runtime/backend evidence**, only inside the boundary actually tested. None was live-verified here.
7. **HTML, screenshots, visual boards and historical reports** as visual or interaction donors only.
8. **Derived summaries and old mockups** as non-authority evidence.

### 3.1 Source classification

| Classification | Sources / claims |
|---|---|
| **LOCKED** | Explicit navigation, role continuity, guest/auth return, AI authority separation, geo privacy, map-pin restrictions, card scan rules, entitlement/zero-price launch, Dogovor tabs/lifecycle, active-block restriction, reviews-after-completion |
| **CURRENT_SOURCE_ONLY** | Donor `src/`, current Supabase files, Expo/RN dependency set, physically advertised checkpoint |
| **TARGET** | Reconciled 30-screen composition, target monorepo, complete state catalog, HTML VNext visual contract |
| **CURRENT_PARTIAL** | Existing component/screen implementations and HTML donors that cover only part of current truth |
| **RUNTIME_UNPROVEN** | Live backend, native behavior, external providers, branch/remote status, production configuration |
| **VISUAL_REFERENCE_ONLY** | Ten boards, accepted Entry/Auth screenshots and current HTML render evidence |
| **DERIVED_NON_AUTHORITY** | Master screen truth matrix and other summaries that repeat stale labels/semantics |
| **SUPERSEDED** | `Aktivno` primary tabs, primary `Dostupnost/Kalendar`, `Tok` tab, price/identity on pins, photo/match reason/raw score on primary Opportunity card, V4 Auth, withdrawn broad V1 visual pass |
| **CONFLICT_REQUIRES_RECONCILIATION** | Missing historical `Prijave` screen ID; global font; retention durations; paid provider/store/legal conditions; anonymous server-AI feasibility; named “female” design tool |

## 4. Canonical product model

### 4.1 Roles and navigation

One account can enter both workspaces. A role switch changes workspace context; it does not log the user out or create a second account.

| World | Primary navigation | Center behavior | Secondary route |
|---|---|---|---|
| Requester | Početna · Potrebe · `+` · Dogovori · Profil | Same AI Need creation flow as every other create entry | Notifications/settings from shell |
| Worker | Početna · Prijave · USKOČI mark · Dogovori · Profil | Opens Prilike | `Dostupan sam` / calendar from Home or Profile |

### 4.2 One lifecycle

| Transition | Actor / command | Canonical owner and write | Other-side effect | Privacy / retry rule |
|---|---|---|---|---|
| Draft Need | Requester with AI assistance | Draft/proposal state; AI output is not canonical | Live card updates locally as facts are understood | Separate proposed vs confirmed; no public write |
| Publish Need | Authenticated Requester | Server validates and creates/publishes Need plus public projection | Matching/recommendation/notifications may begin | Private exact geo stays private; idempotent publish key |
| Discover | Worker | Server-authorized public projection | View/read evidence only | No hidden address, raw score or invented trust facts |
| Apply | Authenticated Worker | Application command; Applications are free | Requester receives Application and notification | Exact return after Auth; retry must not duplicate |
| Select | Requester | Atomic entitlement reservation/activation and exact Application selection | Dogovor becomes active; covered headcount updates | Launch cost zero; no checkout; idempotent selection |
| Execute | Both parties | Dogovor/server is lifecycle authority; chat conveys progress | Realtime messages/status/notification | Contact/location unlock follows active Dogovor policy |
| Complete | Worker then Requester | Worker done; Requester confirms/problem within 48h; otherwise auto-complete | History/reputation/review eligibility | Server clock and idempotent completion commands |
| Review | Eligible party | Review tied to completed Dogovor | Reputation/history update | No review without real completed Dogovor |
| Replacement | Requester under qualifying same-Need condition | Existing entitlement coverage is reused | Replacement Application/Dogovor path | No second consumption; bounded 24h after original execution window |

### 4.3 Monetary truth

Four claims must remain distinct:

1. The **entitlement/reservation/activation engine is real product target**.
2. V1 launch promotional cost is **0**.
3. Paid checkout and cash charging are **OFF**.
4. Later paid enablement requires independent store, legal, fiscal, payment-provider and production proof.

No current visual reference may imply a live card charge, SKU purchase or paid checkout.

### 4.4 AI and location truth

- Conversation is primary; the evolving Need card is persistently visible.
- AI asks only for relevant missing facts and can propose execution facts.
- `AI_PROPOSED → HUMAN_CONFIRMED → CANONICAL_SAVED` is mandatory.
- A correction updates the proposal/card; the final Review is the main whole-Need confirmation.
- Voice and text are input modes. V1 responses may remain text; voice needs visible capture/transcript/error states.
- Guest creation may begin before Auth. Protected publish must invoke the single accepted Auth owner and preserve exact return context.
- Natural-language location is first. Exact/private geo and public projection are separate. Manual map/search is fallback.
- The current server AI path appears authenticated; a fully anonymous server-AI claim is **RUNTIME_UNPROVEN**. The safe reference model is local guest capture with protected server actions until runtime evidence proves more.

## 5. Decision coverage

| Class | Determinations |
|---|---|
| **LOCKED product** | Core proposition; two intents/one account; navigation; role switch; guest/auth return; one Need/Application/Dogovor lifecycle; card decision facts; map-pin privacy; zero-price launch; Dogovor tabs and completion; review eligibility |
| **LOCKED visual working model** | Preserve S01/S02 identity and V5-restored Auth; forest/deep teal, warm ivory, controlled orange; human/urban, youthful, lively; meaningful icon grammar; one obvious next action |
| **SUPERSEDED** | Stale nav labels; Availability as primary; separate Tok tab; generic confirmation rounds; mandatory milestone buttons; old map sheet/pin semantics; V4 Auth; withdrawn V1 broad visual pass |
| **ENGINEERING-owned** | CSS/component architecture; folder structure; state-machine implementation; idempotency keys; test runner; icon normalization; HTML fixture/state harness; exact responsive breakpoints |
| **MIXED / genuinely open** | Final global font; final art-direction choice between legitimate token-compliant variants after screenshots; map provider only if a real implementation tradeoff remains |
| **LEGAL/PROVIDER UNPROVEN** | Exact retention durations; paid enablement; payment/store/fiscal/legal provider behavior; production identity/verification provider |
| **UNKNOWN_REQUIRES_EVIDENCE** | Exact identity-verification trigger copy/provider; complete anonymous server-AI capability; the owner’s vaguely remembered female-name design tool |

No owner decision is needed to resolve CSS, spacing, card variants, navigation, retry, canonical ownership or returnTarget.

## 6. Reconciled 30-screen closure truth

Status vocabulary in this table is evidence-bounded. `STRUCTURE` means source/HTML structure exists; it does not mean visual approval or backend proof.

| ID | Reconciled final name | Contract | Current visual evidence | Interaction/states evidence | Target delta |
|---|---|---|---|---|---|
| S01 | Splash / session resolve | Substantial | Accepted donor | Partial runtime proof | Preserve; document loading/offline/recovery |
| S02 | Ulaz / Clean Home | Substantial | Accepted donor | Entry paths evidenced | Preserve identity; verify all returns |
| S03 | Auth sheet | Substantial | V5 restored Auth is accepted owner | Context return structurally evidenced | Preserve; consolidate one visual/code path |
| S04 | Verify / recovery | Partial | V5/V1 donor | Provider/runtime unproven | Clarify non-invented verification/recovery states |
| S05 | Role readiness / context resolver | Partial | Board/HTML donor | Stale chooser risk | Skip chooser when intent known; show only when needed |
| S06 | Notifications | Substantial | Generic donor | Realtime/read states partial | Rebuild entity-rich rows and full state catalog |
| S07 | Settings / support / legal | Partial | Generic donor | Legal/provider details unproven | Organize account, privacy, support, legal states |
| R01 | Requester Početna | Substantial | V4/V5 donor | Mixed stale nav | New salience; live Need/attention/next action |
| R02 | AI Need | Strong target contract | V1.3 current donor | Voice/guest/failure incomplete | Deep Wave B rebuild: conversation + live card |
| R03 | Potrebe | Substantial | V4/V5 donor | Filters/states partial | Lifecycle-first own-Need cards; empty/error/offline |
| R04 | Need workspace / detail | Substantial | V4/V5 donor | Actions vary by lifecycle | Consolidate status, applications, coverage, next action |
| R05 | Prijave / candidates | Substantial | V4/V5 donor | Selection semantics conflict in old docs | Atomic zero-cost entitlement selection; no fake checkout |
| R06 | Candidate public profile | Partial | Visual fixtures only | Verification/review runtime unproven | Passport hierarchy; provenance-safe trust evidence |
| R07 | Review & publish | Strong target contract | V1.3 donor | Publish/Auth return partial | Whole-Need confirmation; private/public location proof |
| R08 | Dogovori | Reconciled | V5 label is stale `Aktivno` | List states partial | Rename/recompose as Dogovori; differentiated summary cards |
| R09 | Requester Profil | Partial | V4/V5 donor | Dual-role/settings partial | Passport, reviews, role switch, privacy controls |
| W01 | Worker Početna | Substantial | V4/V5 donor | Availability placement conflict | Operations focus: opportunities/applications/Dogovori |
| W02 | AI worker profile | Partial | V4/V5 donor | Canonical-save boundary partial | Structured profile proposal; human-confirmed changes |
| W03 | Prilike | Strong target contract | V1.3 current donor | Map/list refresh partial | Locked map/card anatomy; full state and privacy catalog |
| W04 | Opportunity detail | Substantial | V4/V5 donor | Apply/Auth return partial | Decision facts + private boundary + one apply action |
| W05 | Application assistant / review | Substantial | V4/V5 donor | Old identity gate is unproven | Evidence-grounded review; idempotent submit; Auth return |
| W06 | Prijave | **Reconciled target** | No authoritative complete donor | Historical ID says Calendar/Availability | Build primary Applications list; move availability secondary |
| W07 | Dogovori | Reconciled | V5 label is stale `Aktivno` | List states partial | Rename/recompose as Dogovori; worker next-action priority |
| W08 | Worker Profil | Partial | V4/V5 donor | Availability/profile controls partial | Passport, availability secondary entry, role switch |
| D01 | Dogovor shell | Strong | V4/V5 donor | Old invitation/confirmation residue | Active shell; other party, status, terms, next action |
| D02 | Pregled | Strong | V4/V5 donor | Some old milestone actions | Agreed terms, privacy/contact unlock, embedded chronology |
| D03 | Poruke | Strong | V4/V5 donor | Realtime/offline/retry partial | Chat progress; delivery/retry/attachment/privacy states |
| D04 | Chronology / status section | Reconciled | Separate route donor only | Separate `Tok` conflicts with lock | Embed inside Pregled; not a primary local tab |
| D05 | Cancel / problem / replacement | Substantial | Partial donor | Branch matrix conflict residue | Server-final, reasoned branch, active-block restriction |
| D06 | Completion / review | Strong | Partial donor | Timer/realtime/runtime unproven | Worker done → 48h Requester response → auto-complete |

### 6.1 Closure totals

- 30/30 IDs have a reconciled target role in this audit.
- 30/30 have canonical control rows in `USKOCI_VERIFIED_SCREEN_ELEMENT_CONTROL_MATRIX.csv`.
- 0/30 are declared visually owner-approved as complete.
- S01/S02 and the V5-restored Auth are accepted visual donors, not approval of every state.
- R02/W03 have the newest partial HTML evidence, not full closure.
- W06 requires the largest structural correction because historical documents never allocated the locked Prijave destination cleanly.
- No screen has fresh native/backend/production proof from this audit.

## 7. Component-family truth

| Family | Current evidence | Decision |
|---|---|---|
| Entry / Splash | Strong accepted identity | **PRESERVE** |
| Auth sheet | V5 restored accepted visual owner | **PRESERVE**, consolidate context variants |
| General cards | Many cream/equal-weight donors | **REBUILD** around projection-specific hierarchy |
| V4 dark entity heroes/status bands | Useful salience evidence | **EVOLVE**; avoid making every header dark |
| Live AI Need card | Partial V1.3 | **EVOLVE deeply** with proposal/confirmed/change/missing grammar |
| Opportunity card | Partial V1.3 | **REBUILD** to answer What/Offer/Where/When/People/Requirements/Trust in 3 seconds |
| Requester own Need card | Generic donors | **REBUILD** around lifecycle/coverage/next action |
| Dogovor summary | Generic donors | **REBUILD** around status/terms/party/next action/privacy unlock |
| Map pin/map composition | Old price/photo/sheet residue | **SUPERSEDE** with USKOČI-mark pin and stacked map/list |
| Icons | Inconsistent generic outline usage | **REBUILD** as one normalized, mobile-readable family |
| Bottom navigation | Good shell donors, stale destinations | **EVOLVE** visuals; **REBUILD** semantics |
| Voice/composer | Partial controls | **EVOLVE** with full capture/transcript/error/a11y states |
| Timeline | Separate Tok route residue | **EVOLVE** content; embed in Pregled |
| Availability calendar | Existing donor | **EVOLVE** as secondary route; remove primary-tab status |

Detailed contracts are in `USKOCI_COMPONENT_DOSSIER_MASTER.md`.

## 8. Current HTML diagnosis

### 8.1 Physical HTML evidence

| Artifact | SHA-256 | Verified facts | Evidence status |
|---|---|---|---|
| `CUMULATIVE_REFERENCE_APP_LATEST.html` | `fd5aeab12e9436c8ea6b1fd8f871836e00a54b469a2dde0140c6616f421e4ca0` | Byte-identical to Premium V1.3; four inline scripts parse; no duplicate IDs; newest Need marker; not a 30-route app | **HTML STRUCTURE VERIFIED · CURRENT_PARTIAL** |
| `USKOCI_CUMULATIVE_REFERENCE_APP_NEED_VISUAL_V1_3_PREMIUM.html` | `fd5aeab12e9436c8ea6b1fd8f871836e00a54b469a2dde0140c6616f421e4ca0` | Current partial R02/W03 visual donor | **HTML STRUCTURE VERIFIED · CURRENT_PARTIAL** |
| `USKOCI_FULL_PREMIUM_REFERENCE_APP_AUTH_RESTORED_V5.html` | `856d18b580b44e994524e49d2ccb4ad0b419f8d7cf88474ebb78adb552e39e24` | Three scripts parse; no duplicate IDs; 30 route strings; restored accepted Auth; stale nav and Dogovor residue | **HTML STRUCTURE VERIFIED · VISUAL_REFERENCE_ONLY** |

V5 physically renders stale destinations: Requester `Objavi/Aktivno`, Worker `Prilike/Dostupnost/Aktivno`; it also preserves a separate D04 chronology route and an unproven identity gate. V1.3 has newer Need/Marketplace treatments but is not cumulative. V4 has useful salience work but its Auth was rejected. The broad V1 visual pass was explicitly withdrawn.

### 8.2 Why it feels flat or dead

The problem is a missing salience grammar, not merely insufficient color or shadow:

- too many cream cards share the same weight, radius, border, spacing and density;
- screen purpose, primary entity, status, decision facts and next action compete instead of forming a sequence;
- cards do not consistently expose the 2–5 facts needed for a decision;
- sparse or inconsistent icons fail to create stable scan anchors;
- old navigation and labels weaken orientation even when individual sections look polished;
- generic metric tiles and decorative panels displace task meaning;
- Requester Need, Worker Opportunity, Application and Dogovor cards look too related structurally while answering different questions;
- fixtures can look like factual ratings, verification or earnings without provenance;
- maps/pins and Dogovor affordances retain superseded semantics;
- AI sometimes reads as a chat/wizard rather than a live, human-correctable understanding surface.

The correction is defined in `USKOCI_VISUAL_FOUNDATION_SPEC_VNEXT.md`: one primary visual answer, one status, 2–5 icon-anchored decision facts, one primary action, and secondary detail on demand.

### 8.3 Browser proof boundary

Static HTML and script syntax checks were run. The supplied contact sheets and historical QA reports were inspected. A fresh browser reproduction could not be completed in this session because the local browser driver/browser binary was absent and the remote browser could not access localhost. Therefore this audit claims **HTML STRUCTURE VERIFIED**, not fresh **BROWSER VERIFIED**. Historical screenshots remain visual evidence, not a new pass.

## 9. Top ten risks

1. Derived summaries can silently overwrite current navigation and screen labels.
2. The 30-screen historical taxonomy lacks the locked Worker `Prijave` destination.
3. A new monolithic HTML could combine V1.3 Need with V5 shell while also reintroducing stale lifecycle code.
4. Visual polish can hide private-address, pin-content or trust-provenance leaks.
5. Zero-price entitlement can be flattened into either a fake checkout or a fake “nothing happens” selection.
6. AI copy can accidentally imply that a proposal is saved truth.
7. Dogovor can regress into invitation/confirmation/milestone mechanics that canon removed.
8. A generic shared card template can erase projection-specific decision priorities.
9. Fixture reviews, ratings, identity and earnings can be mistaken for runtime proof.
10. Expanding to 30 screens before closing the Need family will reproduce coverage without visual identity.

The complete conflict set is in `USKOCI_CONFLICT_SUPERSESSION_LEDGER.csv`.

## 10. Next three dependency-correct waves

### Wave A — Foundation / style DNA

Close tokens, typography candidates, surface roles, icon grammar, button/status grammar, card anatomy, headers, bottom navigation, sheets, density, motion and the complete system-state grammar. Produce comparison components and screenshots before screens.

### Wave B — Need family

Close deeply: R01, R02, R07, R03, R04, W03 card projection and W04 detail projection. One canonical Need lineage; distinct projections. This wave proves the visual language, public/private boundary, AI authority boundary and 3-second card scan.

### Wave C — Application / trust

Close W05, R05, R06, R09, W08 and public profile/review/verification explanations. Prove free Application, zero-cost entitlement selection, identity provenance, exact Auth return and idempotent submit/select behavior.

Every wave follows: **SPEC → COMPONENT → RENDER → SCREENSHOT → 3-SECOND TEST → FLOW TEST → CORRECT**. Expansion stops on a visual, privacy, lifecycle or state-catalog failure.

## 11. Environment recommendation summary

| Required decision | Recommendation |
|---|---|
| **RECOMMENDED ORCHESTRATOR NOW** | Current ChatGPT Work/Codex session for canon, package and control-matrix ownership |
| **RECOMMENDED HTML BUILD ENVIRONMENT** | Google Antigravity IDE on a local, versioned reference-only workspace, with browser-in-loop evidence |
| **RECOMMENDED VISUAL COMPONENT DISCOVERY TOOL** | 21st.dev MCP/CLI, with shadcn/Base UI or Radix behavior donors; targeted AI/voice primitives only |
| **RECOMMENDED FINAL RN IMPLEMENTATION ENVIRONMENT** | Claude Code Desktop/CLI with Chrome on the verified Git clone, after explicit clean-build approval |

This is a staged recommendation, not a claim that one model is universally stronger. Details and official evidence are in `USKOCI_TOOL_ENVIRONMENT_RECOMMENDATION.md`.

## 12. Owner decision boundary

No owner decision is required before reviewing this audit direction. Navigation, screen placement, lifecycle, card variants, retry/idempotency, state ownership and HTML architecture can be resolved from the supplied authority.

Later, only these legitimate owner/external decisions remain:

- choose the preferred token-compliant visual variant after Wave A screenshots;
- choose the final global typeface if the evidence package does not add a newer lock;
- resolve the remembered female-name tool only if the owner can provide a distinguishing clue and the choice materially affects the workflow;
- external/legal/provider decisions for retention and future paid enablement.

No HTML VNext implementation should begin until the owner accepts the audit direction. Clean source remains separately gated by the exact build authorization.

## 13. Proof labels for handoff

- Package contents/hashes/bundle head: **SOURCE VERIFIED**
- Authority and reconciled contracts: **CONTRACT VERIFIED**
- Existing HTML parse/route/ID checks: **HTML STRUCTURE VERIFIED**
- Fresh browser reproduction: **BROWSER REPRODUCTION BLOCKED**
- Entry/Auth and other supplied screenshots: **VISUAL REFERENCE ONLY**, except owner-accepted donors explicitly identified
- Full visual system: **VISUAL OWNER APPROVAL REQUIRED**
- Native target: **NATIVE UNPROVEN**
- Live backend: **BACKEND UNPROVEN**
- Production: **PRODUCTION UNTOUCHED**
