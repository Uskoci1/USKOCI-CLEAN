# USKOČI — current UI truth

Date: 2026-09-20. Status: evidence and design brief; implementation is paused for design-direction approval.

## Authority and scope

The owner's latest instruction separates **functional truth** from **visual legacy**. Existing screens establish capabilities, data boundaries and states; they do not establish the new visual baseline. The supplied HTML is a reference, not a pixel specification. The first six Figma explorations were rejected by the owner. Their earlier B/Home + C/AI recommendation is withdrawn.

Read this together with [DESIGN.md](../../DESIGN.md), [UI_DEBT.md](UI_DEBT.md), [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md) and [DESIGN_SYSTEM_PLAN.md](DESIGN_SYSTEM_PLAN.md). These documents propose a new experience; they do not certify the whole application or authorize backend changes.

## Evidence provenance

| Evidence | Exact scope |
|---|---|
| Isolated source branch | `work/html-home-native-20260920`, HEAD at inspection `f9d83f5e7fb04e61bf6843294015b300f86abcb0`; clean before this documentation work |
| Last app-code commit | `149502bb367a7a4f34596ad25d718a24d5d99700`; later commits before this review were documentation |
| Structural source inventory | 157 files / 15,804 lines under `src/app`, `src/ui`, `src/theme`, excluding `__tests__`; imports, JSX, state declarations, conditions and SHA-256 recorded. This is not a claim of line-by-line semantic certification |
| Route inventory | 48 app files: 45 screen/route files plus two layouts and one native-intent adapter. Redirects and wrappers are included; this is not 45 distinct product screens |
| Installed device build | `rs.uskoci.dev`, version 1.0.0 / code 35; previously installed APK SHA-256 `8bbb32e556350644f067c56ff5d4ea491561e73780d16c8a1ece72760d5db870` |
| Fresh device inspection | Connected HONOR VKP-NX9, Android 16, 1264 × 2728; previously recorded font scale 1.15. Home, agreement list, AI intake with existing draft, keyboard, map, selected map task and own profile inspected |
| Prior test evidence, not rerun for this documentation change | [CI run 35477300414](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35477300414): TypeScript, frozen migration inventory and 233 suites / 4,497 tests passed. Skipped domain jobs are not passes |
| Database status inherited from prior verified readback | pkg023j installed; 165 ledger entries = 147 frozen source + 18 dev_alpha. No new live database read or write is claimed by this design review |

The separately active Claude worktree was not modified or integrated. Its uncommitted SQL is not evidence of an applied migration.

### Reading depth

Detailed semantic inspection covered the shared tokens, headers, actions, Home/activities, TaskCard, discovery map and marketplace presentation, AI shell and composer, public task detail, worker profile/interview, agreement workspace/chat/collection, reviews/reputation, public profile, settings, auth controls, support presentation, permission recovery and skeletons. Route contracts, application editing, intake, notification preferences, location/calendar, Q&A, group chat and sensitive actions received targeted source inspection. The structural inventory covers the remaining surfaces; runtime state coverage is explicitly incomplete.

### Fresh device evidence

Evidence files remain local in `work/phone-check/` in the review workspace. They contain real account information and must not be uploaded to a design service. The deliverable evidence manifest records filenames and hashes without draft contents.

| Capture | Observed state and finding |
|---|---|
| `design-phase0-current.png` | Existing agreement list; one real agreement; large enclosed block and substantial unused lower area |
| `design-phase0-home.png` | Existing Home with illustration and two large actions; multiple competing title/action/attention regions |
| `design-phase0-ai-empty.png` | Despite its filename, this is **not an empty draft**: restored unsent text exists. System gesture area intrudes into the composer surface with keyboard closed |
| `design-phase0-ai-keyboard.png` | Same draft, keyboard open; composer moves above keyboard in this observed state; opening suggestions consume remaining thread space |
| `design-phase0-map.png` | Map loaded with real task; title wraps under four header controls |
| `design-phase0-map-selected.png` | Selected task preview: floating orange + overlaps the task-detail action; nested card geometry dominates the map |
| `design-phase0-profile.png` | Large monogram/name/location region before capability and settings information |
| `design-phase0-restored.png` | Phone returned to the original agreement-list surface |

No draft was changed, no message sent, no microphone started, no task/application/review created, no account changed, no permissions toggled. Keyboard was opened and dismissed. These observations prove those visual states only, not complete journeys, voice operation or iOS behavior.

## Functional truth to preserve

| Product responsibility | Existing implementation / boundary |
|---|---|
| One account, both marketplace activities | Relationship is per task/agreement. Do not reintroduce a global requester/worker mode or a role-switch gate before opening a notification |
| Entry and authentication | Original brand/entry assets and identity remain usable; auth, recovery, account revision and session guards remain authoritative. Their visual placement is open to redesign |
| Task creation | AI conversation collects facts; manual correction, location, dates, photos and final review remain reachable. Opening intake alone does not create a task. Publication remains an explicit confirmed command |
| Voice V1 | Dictation produces editable text followed by explicit Send. Full spoken AI conversation is later. No automatic submission, fabricated waveform or simulated transcript |
| Discovery | List and map share the same allowed task set. Public approximate coordinates stay approximate; remote/unpinned work remains discoverable without a false pin |
| Applications | Offer amount, people, interval, note, revision review, withdrawal and confirmed command reconciliation survive. A prettier CTA cannot bypass stale/closed/unknown states |
| Candidate selection | Show actual offer/capability/availability facts, compare and select through existing commands; no synthetic rating or verification signal |
| Agreement | State, people, accepted terms, next permitted action, problem, proposed changes and completion stay based on the projection and command receipt |
| Messages | Preserve unsent text, private photos, sending/confirmed/unknown/failed distinctions, request identity and recovery; do not claim an unconfirmed send succeeded |
| Reviews | Native review entry, rating/tag controls, saved receipt and reputation views already exist. Earlier claims of “0% implemented” are false; complete device coverage remains open |
| Notifications | Correct object landing, unread state, settings, permissions and retention of last known settings matter independently of visual layout |
| Support and safety | Reporting, blocking, support context, restricted operator surface, privacy, export and account closure remain accessible and permission-bound |
| Location/calendar | Civil time, zone, exact/private versus approximate/public information, selected interval and availability semantics are not styling choices |

Home attention remains exactly the four established cases: caller's requester confirmation, active agreement with open problem, caller's active stale/server-flagged application, and caller's own task with applications to choose. A new visual order must not invent additional server facts or silently change eligibility/counts.

`src/app/(app)/index.tsx` still reads the three collections. pkg023j being installed does **not** mean Home uses it. Aggregate wiring and paging are separate, open engineering work.

## Visual legacy to challenge

The current dominant pattern is white canvas + oversized title + rounded bordered cards + multiple icon wells. Several otherwise different tasks inherit that pattern. This is a design diagnosis, not a functional failure.

- Home should answer “what needs me now?” and “what can I do here?” without two enormous blocks displacing actual work.
- Discovery should make geography and task choice work together. A card nested in a scrollable card over the map, competing with a floating create action, does not earn retention.
- AI should devote the viewport to the current question and the user's answer. An oversized welcome, multiple starter pills and competing input modes do not earn retention.
- Agreements should look like consequential shared work, with next step and accepted terms readable immediately. A generic marketplace card does not establish that hierarchy.
- Profile should communicate identity, capability and evidence of trust early. A large initial is not itself reputation.
- Existing navigation presentation is a hypothesis. Preserve destinations, back/deep-link continuity and one-account behavior; compare different visible organizations before choosing.

## Classification, not indiscriminate cleanup

| Category | Current assessment | Required handling |
|---|---|---|
| Working logic | Controllers, projection contracts, receipt/revision checks, scope/focus guards and explicit commands | Retain semantics; test meaningful affected journeys after UI changes |
| Working but visually weak | Home, task/selection preview, agreement collection, profile and several form/settings families | Recompose from the product problem, not from current JSX |
| Inconsistent | Semantic action styling across `Button`, `V2Action`, auth actions; white inner surfaces versus warm reference ground | Define shared meanings, preserve feature wrappers until callers can migrate safely |
| Shared compatibility layers | `ui/v2/tokens.ts` and `ui/aiFirst/tokens.ts` alias the shared system | Do not describe them as independent duplicate systems or delete by filename |
| Potentially unused | `NeedPublicationPanel.tsx`, `referenceEntry/ReferenceEntryHero.tsx` had no external runtime import found in the inspected source search | Deletion candidate only. Require complete reference/export/platform/test/asset checks first; no deletion in this review |
| Compatibility navigation | `prijave.tsx`, `pregled-nacrta.tsx` redirects | Keep deep-link compatibility until proven unnecessary; `dogovori.tsx` is an active tab |
| Test scaffolding | Test doubles are not product completion evidence | Keep legitimate tests; prove production import/gating before any cleanup |
| Missing evidence | Small Android, iOS, large text, screen reader, reduced motion, offline and most edge-state screenshots | Record as unverified, not passed or missing functionality |
| Unsafe to alter casually | Auth/RLS, exact location/privacy, lifecycle transitions, unknown outcomes, immutable review receipt, closure/erasure | Separate engineering change and authorization where applicable |

## What is not settled

No release-readiness percentage is warranted. Payment is for the **connection service**, not job escrow or payout. Pricing model, purchase moment, provider and store treatment still require a separate decision; do not introduce coins, wallet, escrow or per-person pricing into screens as accepted facts. Identity verification must reflect actual capability and owner gates, not a decorative badge. No design file may invent production readiness.

## Gate

The owner's request explicitly ends this phase before implementation. Deliver the access registry, evidence, 15 reference groups, inventory, constitution and report. The latest owner instruction additionally authorizes an organized Figma reference board. Existing product frames, app code, dependencies and database remain unchanged; new product screens and implementation wait for review. Verbal composition hypotheses do not count as the later three rendered alternatives.
