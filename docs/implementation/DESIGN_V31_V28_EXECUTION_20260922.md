# USKOČI — V28/V31 design review and R5 execution specification

Date: 2026-09-22. This supplements R5 of APP_FINISHING_PLAN_20260922.md.
It does not supersede the unified R1–R9 release plan, product decisions, server contracts or approvals.

## Decision and owner correction

The owner supplied V31 BALANCED PREMIUM and V28 PREGLED for comparison. He values V28's legible,
larger cards, but wants better-balanced density. During this work he explicitly rejected the initial
proposal's generic native icon treatment and clarified that V28's **colored illustrated icons, colors,
clean presentation and bottom navigation must survive**. This latest instruction governs.

Recommended direction: retain V28's visual identity and illustrated vocabulary; improve composition,
information grouping and size. Use V31 as a density study, not as the final authority. Do not drift back
to the existing native application's old visuals or treat the uskoci-design skill's earlier restrictions
as a reason to reject the owner's new direction. The engine remains authoritative.

The current deliverable is an independent interactive card study, not an implemented app redesign:
outputs/design-v31-v28-20260922/PREDLOG.html. It contains three compositions, four contexts, four states,
long-title and enlarged-text controls, and a screen-family/motion plan. The corrected version uses static
V28 artwork and a V28-style inset navigation bar. Its navigation changes the local card context.

## Evidence and limits

Sources supplied by the owner:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| USKOCI_V28_PREGLED (1).html | 1,268,166 | 29fbe6cbdcf333fc9594ab3c552871b444ea9e16bb9884f13d0ba36c35337314 |
| USKOCI_V31_BALANCED_PREMIUM.html | 1,322,310 | 6870214a7b728830521932a4de7feef9c3003c6e8629bfa69b3212d133a63945 |

The reference HTML sources were inspected statically. Opening the original file in the browser was
blocked by the browser URL-safety policy; its runtime appearance was therefore NOT visually verified.
Do not call the comparison a pixel-perfect visual audit or treat source CSS sizes as measured layout.

The new proposal is authored independently, runs locally with no network/data calls, and has a restrictive
CSP. It does not execute scripts from either reference. The original logo was extracted as validated
static SVG. The final 15 colored/muted vector assets were reconstructed from the reference's v17ArtPaths
using whitelisted literal expressions and XML validation, not by executing downloaded JavaScript.
Prototype data are explicitly local illustrations, never DEV records or evidence of completed flows.

Read production source bodies in this pass:
- src/data/homeSnapshot.ts: composeHome and preview/state contracts.
- src/ui/v2/TaskCard.tsx: ownership, attention, price basis, schedule, capacity and navigation.
- src/ui/aiFirst/AiConversationShell.tsx: composition, pending, keyboard and enlarged-text behavior.
- src/ui/agreements/AgreementWorkspace.tsx: props-driven next action and workspace.
- src/app/(app)/_layout.tsx: three root tabs and contextual/full-screen routes.
- src/ui/system/tokens.ts and package.json: existing implementation resources.
The route inventory was mapped for planning. This is not a fresh semantic audit of every route body.

## 1. What the references contribute

V28 contains 27 style blocks and five script blocks. V31 contains 30 style blocks and eight script blocks.
All 27 V28 style blocks appear byte-identically in V31 in the same order; V31 adds V29, V30 and V31 density
overrides. This illustrates accumulated experiments, not a clean design system ready to import.

| Surface | V28 contribution | V31 consequence | Native decision |
| --- | --- | --- | --- |
| Card title | Full width; room for longer title | Compact title with adjacent metrics | Keep full readable title; no price competing on the same line |
| Details | Separated place/date and price/capacity | Tighter facts and footer | Group into three levels: task, terms, relationship/next action |
| Price | Explicit per-person/total labels | Final metrics prints amount without its basis | Always keep price basis; application and Dogovor totals have distinct labels |
| Photos | Real optional thumbnail in card renderer | New discovery/Home/map faces omit that thumbnail call | Support a real optional image; never add stock photos pretending to be the task |
| Occupancy | Capacity facts | Compact fraction with a very small label | Prefer “Još 2 mesta”, “Dogovoreno 1 od 2”, or “U prijavi: 2 osobe” |
| Person | Publisher/reputation as a distinct row | Tighter/truncated publisher and small ratings | Preserve readable reputation and absence of reviews; no fabricated badges |
| Own task | State and explicit candidate action | Generic “Aktuelan” replacement in some prototype paths | Use authoritative state and selectable count; occupied capacity does not mean completed |
| Icons | Dimensional colored SVG details | Inherited identity remains available | Retain the actual V28 artwork; adjust optical size, not replace it with generic outlines |
| Bottom navigation | Inset three-part treatment, illustrated icons, map emphasis | Mostly inherited | Preserve style; native safe area and keyboard behavior must be verified |

Concrete reference functions: V28 refinedTaskFace, v14HomeTask, v17ArtPaths, premiumFactIcon,
refinedNavIcon and the V26 nav override; V31 metrics, publicFace, postedFace, applicationFace,
taskCard, v14HomeTask and v27PinHTML overrides.

The V31 active card styles include title19.5px, facts13px, price18px, and occupancy label9.5px,
with further reductions below359px. The proposed improvement does not shrink important facts to fit a
fixed card height. V28 has conflicting historical selectors; exact computed card padding remains unmeasured.

Do not port HTML appCount, selectedPeople, v24Attention or local role/status heuristics. In particular,
candidate count and “what needs me” must use the server-backed production meanings, including unavailable
sections rather than invented zeroes. Do not import categories, payment assumptions or local AI demo logic.

## 2. Three card compositions

All three are rendered in the independent proposal with the same illustrative facts:

1. **Balans — recommended general family.** Full-width title; place/date as readable rows; amount/unit
   and people grouped beneath; separate person or next-action footer. Best for discovery, own tasks
   and applications. Tradeoff: more height than V31's compact split metric.
2. **Prostor.** Larger title, more space between groups, soft surface distinction and roomier person row.
   Good for an important task or users who prefer larger text. Tradeoff: fewer results fit onscreen.
3. **Tok.** Date rail and a continuous divided list instead of a stack of rounded containers.
   Strong for dated Dogovori and calendar agenda. Weak for tasks with flexible/unknown dates; do not make
   it the universal task pattern.

The 2026-09-22 owner correction applies to all three: V28 artwork and color/navigation character are shared.
Only layout is being compared. No variant has yet received final owner selection.

Card implementation requirements:
- Start around20px title,15px facts,13px secondary labels,20–22px amount; adapt to content and native font scale.
- No hard height. Money unit and important status must wrap, never vanish behind ellipsis.
- Optional real photo occupies approximately64–76px where it earns space; no blank image box when absent.
  This card study deliberately isolates typography and has no photo fixture; the photo composition is still
  required before implementing the final discovery/detail family.
- Keep remote/location, exact/flexible schedule, team capacity, equipment and conditions when applicable.
  Show the most decision-relevant condition plus a route to the rest; do not hide a blocking condition.
- Separate public task price, submitted application total and accepted Dogovor amount.
- A task with no rating has “Još nema ocena”, not 0 stars or a made-up score.
- Owned task, application and Dogovor have different next actions despite sharing tokens.
- Whole-card press has one unambiguous destination. Secondary actions must not be nested buttons.
- Native interactive targets at least44pt on iOS /48dp on Android; prototype studio controls are not app controls.

## 3. Complete screen-family plan

The following are composition explorations, not claims that all these screens were rendered.
Before each major family is implemented, render its three alternatives with relevant states,
compare them, select/combine, then reuse any existing visual elements that still deserve a place.

| Family and functional responsibility | Three different compositions | Recommended synthesis and tradeoff |
| --- | --- | --- |
| Entry/auth: understand the service, sign in, recover and return to intended action | Brand scene with two intentions; concise editorial welcome; action-first entry with contextual sign-in | Brand scene plus direct access. Keep logo/motif, avoid a mandatory long animation on every launch |
| Unified Home: both own tasks and applications, attention, upcoming work | Priority feed; today agenda plus activity stream; two role columns with shared attention | Priority feed with a short agenda. Both sides stay together; no permanent role switch or full duplicate lists |
| Discovery: search, filters, selected task, map/list parity | Map with selected-pin card; list-first search with map switch; map plus draggable results drawer | Map/list parity and one selected card; drawer only if gestures and keyboard are proven. Preserve V28 inset map navigation |
| Task detail: decide whether and how to apply | Editorial detail with optional gallery; compact fact board then description; expandable task sheet | Editorial detail with terms block and one contextual primary action; full screen for long content |
| AI task interview: gather facts, preserve draft, recover uncertain outcome | Conversation with folded draft; progressive question canvas; split live-form/interview | Conversation plus folded draft. Avoid a large pinned card consuming the keyboard viewport |
| Review/publication: correct facts and publish once | Sectioned document; card preview with edit links; short step-by-step confirmation | Sectioned review with final card preview. Editing returns to the same section; unknown publication outcome requires recovery |
| Worker interview/profile: skills, resources, team, availability | Conversation then profile review; guided capability chapters; profile preview alongside editors | Conversation followed by editable sections. No invented professional claims or unsupported verification |
| Application/candidates: submit precise offer and select available people | Offer cards; comparison list with expandable detail; shortlist workspace | Comparison list with full offer detail. Keep price, team size, terms, reputation and selection state together |
| Dogovor/chat: accepted facts, communication, next action | Conversation with collapsed terms; action-first workspace plus chat; timeline and separate messages | Small next-action region plus conversation, accepted terms a tap away. Revised terms stay distinct from accepted terms |
| Completion/problems/rating: close safely or resolve exceptions | Action panel; chronological resolution timeline; guided confirmation flow | State-specific action panel and a resolution history. Never imply cancellation and completion are equivalent |
| Profile/reviews: identity and earned trust | Person-first profile; work capability portfolio; review-led reputation page | Person-first overview with capability sections and real reviews; no decorative trust claims |
| Notifications: read event and reach owned subject | Event list; task-grouped inbox; priority section plus chronological history | Event list with short priority section where supported. Push sender/client allowlist/deep-link work is an engineering contract |
| Settings/data/support: configure and recover safely | Grouped settings list; searchable control center; guided task pages | Grouped list with dedicated export/closure/support journeys. Long-running status must survive relaunch/account changes |
| Connection charge: understand and pay for agreed service | Contextual price disclosure; connection summary then checkout; entitlement/usage page | Decide only after the commercial event and permitted payment route are approved. No invented wallet, coins or escrow |

Source-route map for implementation:
- Entry/auth: auth.tsx, oporavak.tsx and the existing entry/intent handling.
- Home: (app)/index.tsx, moje-aktivnosti.tsx, moje-prijave.tsx and homeSnapshot.
- Discovery/detail: mapa.tsx, prilike.tsx, prilike/[id].tsx, potrebe/[id]/pregled.tsx.
- Task authoring: nova.tsx, pregled-nacrta.tsx, pregled-zadatka.tsx, mesto-zadatka.tsx,
  fotografije-zadatka.tsx, pitanja-zadatka.tsx.
- Application/selection: prilike/[id]/prijava.tsx and potrebe/[id]/kandidati.tsx.
- Work profile: profil/radnik.tsx, profil/razgovor.tsx, dostupnost.tsx, lokacija.tsx and raspored.tsx.
- Agreement: dogovori.tsx, dogovor/[id].tsx and lokacija/izmene/grupa children; oceni-dogovor.tsx.
- Account/reputation: profil.tsx, profil/podaci.tsx, profil/fotografija.tsx and actual review readers.
- Notification/safety: obavestenja.tsx, profil/obavestenja.tsx, bezbednost.tsx, blokirani.tsx.
- Data/legal/support: profil/izvoz.tsx, privatnost.tsx, pravna.tsx and podrska routes.

Do not remove a route because another screen looks newer. First inspect imports, notification/deep links,
navigation callers, pending commands and recovery. Preserve the unified Home requirement even if the
HTML calls its first tab “Zadaci”; changing the shipped label is a separate copy choice, not automatic porting.

## 4. Shared components and states

Build a small native system from the chosen family: ScreenHeader, PrimaryAction, TaskFacts, PriceBlock,
CapacityLabel, TaskCard variants, PersonAndReputation, StatusAndNextAction, AcceptedTerms, MessageBubble,
MessageComposer, PendingOutcome, EmptyState, SectionError, Sheet and SectionEditor.

Proposed V28-derived palette:
ink #20362c, secondary #5e6d64, action green #076e4e, orange #FF7908,
white surfaces, pale #eff6f0, border #e1e8e1. Colored illustrations retain their own V28 highlight/edge palette.
Do not globally replace tokens before testing the first complete slice. Measure contrast for actual
text/background pairs; orange is not automatically suitable for small text or white button labels.

For every family cover first loading, known empty, partial failure, offline/stale data, pending mutation,
unknown outcome, confirmed success, permission denied, long content and enlarged text.
Unavailable is not empty. A visual spinner never grants permission to resubmit an uncertain command.
Destructive/financial actions retain their actual review and authorization steps.

## 5. Motion and reusable systems

| Purpose | Implementation direction | Behavior |
| --- | --- | --- |
| Press feedback | Existing Reanimated/native press states | About100–150ms; tiny scale/color response; no delayed action |
| Navigation | Native transitions and existing Gesture Handler | Preserve back gesture; no artificial wait between every screen |
| Small contextual panel | Existing native primitives, evaluate Gorhom if necessary | Approximately220–280ms; keyboard-safe; long forms use full screen |
| AI processing | Existing native animation or selected asset | Only while actual processing; no fake speech/percentage/generated text |
| Confirmed success | Small native mark or selected Lottie | Once, roughly400–600ms accent; never before a confirmed receipt |
| Empty state | V28 vector illustration, optional selected Lottie | Calm default; limited/one-shot movement, useful next action |
| Interactive assistant artwork | Rive only if state-machine behavior is needed | Driven by actual listening/processing/error states; full voice remains later |
| Chat | Existing backend with selected UI patterns/components | Real pending/delivered/read states only; attachments and privacy retained |

Both HTML files embed the same five Lottie JSON compositions: success, signal, thinking, empty,
connection. Each declares90frames at60fps, and no external assets. Their sources include Lottie5.13.0
and Motion12.23.24 browser loaders and fallback SVG. A loader/JSON's existence is not native compatibility,
a successfully loaded animation, or proof of ownership/license. Selected files need per-asset review.

Actual tooling status:
- Existing packages read: Reanimated4.5.1, Gesture Handler2.32, phosphor-react-native3.0.6,
  react-native-svg15.15.4, expo-image3.0.17, MapLibre11.3.10, @expo/ui57.0.14; Expo57/RN0.86.
- Figma connector successfully listed the existing file's libraries, including Apple and Material kits.
  No new frames/components or Code Connect mappings were created in this pass.
- The proposal uses V28 static vectors, its original brand, and original CSS/SVG motion examples.
  It does NOT contain a Lottie or Rive runtime. Phosphor remains available for appropriate utility work,
  not a justification to replace the owner's preferred illustrated visual language.
- Mobbin has not been connected: the owner has no account. Its paid-plan requirement must not block work.
- Lottie/Rive/Gorhom/ready-made chat SDKs are not installed by this pass.
- Stream would introduce a new messaging service, with identity/privacy/export/erasure implications.
  Prefer evaluating a UI-only chat approach against our existing backend before changing architecture.
- Figma/Code Connect becomes useful once shared components are selected; map actual native props and states.
  Kits and inspiration are not a substitute for implementing and verifying those states.

Reduced Motion uses static settled artwork, not a long fade; pause/destroy offscreen players.
Avoid multiple perpetual animations on a task feed. Profile icons and ratings do not all need motion.
Do not install packages or subscribe to a service under the phrase “use all available systems”.

Official references consulted on2026-09-22:
- https://mobbin.com/mcp
- https://gorhom.dev/react-native-bottom-sheet/keyboard-handling
- https://rive.app/docs/runtimes/react-native/react-native
- https://github.com/kesha-antonov/react-native-chat
- https://getstream.io/chat/sdk/react-native/
- https://lottiefiles.com/page/license
- https://help.lottiefiles.com/discovering-downloading-and-uploading-animations
- https://lottiefiles.com/free-animation/search-IQP7izzwtO — search candidate only, not visually approved or downloaded.

## 6. Delivery sequence and gates

1. Finish card/identity selection with V28 details preserved. Add real-photo composition and navigation
   safe-area exploration. This proposal is the current reviewable artifact.
2. Native foundation plus one complete Home → task → relevant application/Dogovor read journey.
   Wire real statuses/counts and unknown states; review against the chosen composition, not the old UI.
3. Discovery/map/list/detail/filters and authoring review; preserve location privacy and price units.
4. AI task/worker conversations, profile editors and keyboard behavior; keep first-release dictation.
5. Candidate comparison, selection, accepted terms, messages, completion/problem/rating.
6. Notifications/settings/privacy/export/closure/support, including all recovery states.
7. Selected graphic animations and final motion pass, accessibility, Android/iOS device verification.
8. Rejoin the unified release gates: commercial/legal decisions, production preparation, pilot and store assets.

Engineering work remains independent: pending PushPreferences recovery, conditional PKG045b rollout,
remaining contract audit/closure recovery and real push delivery. Design progress does not close these.
Do not report “all flows work” or readiness for stores from this study.

## 7. Verification record

The independent proposal's JavaScript passed node --check.
In the in-app browser, Balans/Prostor/Tok were each checked at320/360/390/430 card widths with the long
title and enlarged text enabled (22px base rather than16px). All12 checks reported no horizontal overflow
in the phone/card/title/facts/footer surfaces. This is not a200% native accessibility sign-off.
The second application card opened a matching title/location/date and a10,000RSD total for2people,
rather than the previous hardcoded first-card detail. Native keyboard, performance, screen-reader order,
200% text, real devices and all app journeys remain implementation gates.

No app source, dependency, Supabase data, migration, credential, APK or Figma canvas was changed.
The reference HTML originals were left unchanged. The foreign migration remains untracked and untouched.
