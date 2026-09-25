# USKOČI premium experience — research-to-product plan

25 September 2026. **Proposal and research synthesis, not an implemented runtime batch.**
Baseline: repository `9e13245f`, runtime `8500bf29` (R17). No fresh DEV inspection, provider call,
business action, installation or test execution is claimed by this document.

This extends `USKOCI_MASTER_PLAN_DIZAJNA.md`; `docs/control/redovi.json` remains the single execution
tracker. Do not create another competing backlog or reopen completed work merely because the research
document describes it. The owner's request authorizes this investigation and plan, not new backend deployment.

## 1. Product identity that survives every design change

USKOČI helps people turn a real need into a clear offer and an accountable agreement. Preserve:

- One account, both intents: **Objavi zadatak / Uskoči i zaradi**. No compulsory global role switch.
- Distinct objects: task, application/offer, accepted Agreement. Team capacity, requested people,
  offered people and accepted coverage are different facts.
- Task-first local work, with honest remote work support; no invented map point for remote/no-point work.
- The actual task price basis and accepted total. Missing price, requesting offers and zero are distinct.
- AI as assistance with an editable draft and human review. The user owns the final publication/commitment.
- Serbian, direct and warm “ti”; approachable green/orange identity, actual human portraits where authorized.
- Public approximate place versus authorized private task address. Nearby centers the map on explicit intent;
  this plan does not add persistent location or resurrect the retired live-location feature.
- Server-owned eligibility, state transitions, deadlines, privacy, command journals and unknown-outcome recovery.

Premium here means a recognizable, attractive product whose decisions are easy and whose interactions remain
stable. A user should understand work, place, time, people, price basis and next action without learning our code.

## 2. What the document and external verification establish

Input: `USKOCI_MOBILE_UX_RESEARCH_2026_v1.docx`, 62 areas, 50 references, eight worked scenarios and seven
implementation appendices. It did not audit this repository or conduct USKOČI user research. Its hypothetical
prices, people and tasks are examples, not evidence of a completed flow.

Read the two source audits beside this plan. They distinguish empirical results, platform guidance,
technical capabilities and product examples. Access to an abstract is not access to full methodology.
Public competitor help pages do not establish the current pixel layout of every app experiment.

Important refinements:

1. The PNAS reputation study reports 8,906 registered/responding users, **6,714 completers**, with US invitations.
   Reputation informs trust but does not certify a worker's safety or predict Serbian marketplace behavior.
2. Baymard's 30-app public overview is a selected-app benchmark, not a representative experiment on all apps.
3. Google's expressive-design findings do not prescribe our palette or guarantee the same speed improvement.
4. Lottie S41 is a **Web Player v0.x** source; interactive state-machine behavior cannot be presumed in our RN runtime.
5. Accessibility units/levels differ: native dp/pt are not CSS pixels; WCAG2ICT is informative; motion criterion
   2.3.3 is AAA. Accessibility is not a mandate to inflate default typography or remove ordinary fluid movement.
6. Source S33's June 2026 update is a CSS change, not fresh research evidence. Airbnb public location policy has
   options/exceptions; preserve USKOČI's own stricter contract, not a borrowed privacy assumption.

## 3. Current evidence and what not to rebuild

Read `CURRENT_GAPS.md`, the R17 receipt/native reviews and the R11 screen inventory. Fresh work here reviewed
selected current function bodies and six existing R17 images; the 40-route coverage matrix incorporates the
earlier inventory and explicitly does not mean 40 new device checks.

- One three-root navigation already exists: **Početna / Zadaci / Dogovori**. Map/list share Zadaci. Details and
  focused flows hide the root bar; history restores the parent. Keep this architecture.
- White surfaces, ordinary strong Inter, FactArt, truthful task values, branded map pins, filters, local draft
  disclosure, candidate comparison and accepted-work presentation already exist. Refine composition, not names.
- Task review already edits individual facts; worker AI already offers manual/profile/availability editing.
  Improve discoverability and return continuity; do not build a second manual workflow.
- Existing packages already include Reanimated, Gesture Handler, Gorhom Bottom Sheet, MapLibre,
  Lottie React Native, Phosphor, Expo haptics/image/location. No new package is needed for the first batches.
- R17 recorded passing types and 316 suites / 6,151 tests. These are **historical R17 results**, not rerun results.
  Phone evidence is pin/detail/back only; Home/Agreement/AI screenshots are inert emulator fixtures.
- Docked-keyboard follow behavior remains unproved (R14-N01); a latest-message pill overlapped expanded AI
  context at 320dp/font 2; first-load retry cause and physical-phone filter acceptance remain open.
- DN-01: known own tasks are still excluded; after a relations failure, refreshing an identical ID list does not
  reliably retry relations. The owner allows own tasks if distinctly labeled. Unknown ownership is not “other”.
- Human chat refresh can clear the transcript; full-history reads and a read acknowledgement without a precise
  displayed-message boundary complicate pagination. Rating reads fan out per completed Agreement (RC-03).
- Safety lacks a named target presentation/explicit block confirmation in the inspected body. Rating comments
  remain a separate server contract; a text box must not imply that comments are already supported.

## 4. Visual direction and decisions

Three directions were considered:

| Direction | Useful quality | Cost for USKOČI | Decision |
| --- | --- | --- | --- |
| Photo-led catalogue | Human, aspirational, easy image scanning | Many genuine jobs have no useful photo; large mandatory images push out terms | Use actual photos in detail; optional compact images only if tested, never fabricated fillers |
| Dense operational dashboard | Many obligations visible | Feels like back-office software; roles/statuses compete and first-time use becomes hard | Use compact fact rows inside relevant workflows, not as the app-wide visual language |
| Work-led editorial surfaces with human identity | Work is legible, terms comparable, accepted commitments distinct | Requires purposeful per-screen composition rather than one universal card | **Selected direction**, with useful photography and contextual controls |

The palette remains clean white, dark readable ink and measured green/orange accents. No mint page wash,
retro ivory, global glass treatment or wallpaper behind reading text. Depth comes from spacing, precise edges,
photography, purposeful illustration and neutral elevation. Not every row needs a border or shadow.

Retain one Inter family, ordinary-size body/fact text and clear semibold/bold emphasis. Use tabular numerals
where comparison needs alignment. Do not shrink price units or counts below the owner's 12 minimum. Start
from existing tokens, measure real content and adjust individual roles only when necessary. No arbitrary rule
such as “exactly four font sizes”, “80px section gaps” or a mandatory color percentage overrides the phone.

Two icon responsibilities: compact consistent control icons (back, close, filter, attachment); richer FactArt
for place/time/people/work and selected navigation. Refine inconsistencies within these families. Do not mix
unrelated stock styles. Original illustration is reserved for a useful welcome, empty state and true success.

Three recognizable object anatomies:

| Object | First impression | Supporting facts | Action |
| --- | --- | --- | --- |
| Task | The work and its terms | Place, time, people, key requirement; actual photo if informative | Open detail; contextual apply/own/already-applied state |
| Offer | The person and precisely what they offer | Amount + basis + coverage, time, equipment, message, actual reputation | Review then accept those exact terms |
| Agreement | The accepted work and what needs me next | Person, accepted time/total/coverage, current step | One valid next step, with messages and exceptions nearby |

This difference is composition, not three independent token systems. Shared facts, controls, focus and motion
remain consistent. No redesign may silently drop the team, pricing, changed-offer or uncertainty states.

## 5. Screen-level target (existing implementation first)

The companion `SCREEN_PLAN.md` covers all 40 active route destinations and five compatibility redirects.
The following contracts cover the main experience, including panels not represented by their own route.

| Surface / decision | Existing foundation | Planned improvement and placement | Boundary / acceptance |
| --- | --- | --- | --- |
| Home: what needs me? | Two starts, four attention reasons, next Agreement, own tasks/applications | Keep two starts, compact root header; attention as action rows; next accepted appointment; personal lists below. No unrelated search | Preserve four server reasons, counts, partial reads; RC-03 must not hide active appointments |
| Discovery: which work fits me? | One map/list, search, draft filters, branded pins | One search/tool surface, visible applied criteria; same selection in pin and sheet. Reduce competition among chips, zoom, credits and preview | DN-01 first. Return preserves camera/scroll/filter draft; no-point/remote remain accessible |
| Map: where is this work? | Public points, clustering, selected capsule, logo fallback | Keep branded mark; legible selected state, bounded labels, measured unobscured map region. Make provider credits reachable/readable without a large competing rail | Preserve attribution; no private coordinates or pretend distance. Dense-data rendering is measured |
| Filters/search: narrow deliberately | Date/place/price/work-mode/people choices, apply/reset | Open sections, compact values and draft selection, anchored Apply. Dismiss cancels unapplied changes; applied chips removable | Count is exact only for covered results. Server query parity before global counts, distance or sorting promises |
| Task detail: should I apply? | Actual facts, pricing distinction, publisher, protected place, actions | Photo when present; work title; compact place/time/people; price with coverage sentence; important requirements; description; map/Q&A/person; one contextual footer | Preserve unknown/own/already-applied/closed states; “Tražim ponude” is not a number |
| Offer: what exactly am I sending? | Composition, price/people/time/note, review | Readable grouped inputs, running truthful total, final receipt after send; compact review with direct edits | Preserve task-basis math, caps, repricing/stale checks, command identity and unknown-result recovery |
| Candidate choice: who covers this job? | Person projection, offer detail, comparison | Compare identical attributes in vertically aligned sections; expandable message without concealing acceptance terms. Show accepted coverage/remaining scope only from known facts | No cheapest-only rank or invented trust badges; selection rechecks current offer; profile return retains selection |
| AI task: turn my words into a reviewed task | Conversation + disclosed draft + fact editors in review | Keep dialogue primary. Make existing editable facts easier to reach; return to same context. Compact draft while typing; no permanent dashboard consuming conversation | Do not label fixture replies as provider quality. UI edits use existing supported commands |
| AI worker: describe what I can actually do | Separate skills/equipment/team/area/availability manual panels and frozen review | One coherent capability summary with links to its existing structured editors; explain remaining activation requirements at their place | Team capacity is not automatically offered people; preserve full frozen review, licence/self-declaration truth |
| Agreement: what must I do now? | Overview/messages, current terms, actions, changes/group | A calm accepted-work header, factual progress, next-step block, accepted terms, secondary contact/problem entries; messages have writing priority | Do not invent “on the way” or “arrived” states; no status beyond existing state machine |
| Human/group/support chat | Existing messages, outbox, attachments, retries | Non-destructive refresh; compact contextual header; stable history, keyboard and latest control. Attachment progress local to attachment | Pagination and precise acknowledgement must be designed together; no fake delivery/read receipts |
| Changes/completion/review | Existing guarded command flows | Before → proposed terms, one decision; completed versus awaiting confirmation explicit; neutral rating and optional supported tags | No new legal consequence; comment waits server package; do not preselect five stars |
| Profile/availability/calendar | Existing grouped profile, work area, weekly/exceptions editor | Public identity distinct from private settings; actual proof/ratings; readable week and exceptions, busy accepted appointments distinguished | Do not invent verification, autoactivate profile, or present unavailable slot as booked |
| Inbox/push | Existing kinds, destinations and channel controls | Object + event + next action; group where no event meaning is lost; exact navigation after tap/cold start | Push delivery, permission and enabled state verified separately; no private-address payload |
| Safety/support/privacy/auth | Existing authorized routes and guarded actions | Named target, block confirmation, short topic selection, readable case timeline, clear export/closure progress; focused login/recovery | Need trusted identity read; keep moderation, account erasure, policy and provider availability intact |

AI response policy proposal: acknowledge naturally when useful, ask the next relevant missing question, avoid
repeating a complete understood summary after every turn. Facts stay in the draft. Use a brief recap only on a
material correction, ambiguity or before commitment. A warm sentence and occasional appropriate emoji can be
used; no fixed word count or emoji after every response. Date/price/name ambiguity deserves confirmation.
Provider/prompt changes require their own evidence and deployment authorization; this plan does not execute them.

## 6. Motion and assets

Use the existing normal soft motion; system Reduce Motion remains an individual preference. Reuse the current
press/toggle/enter/exit/push/camera values (120/180/240/160/280/360ms) as measured starting points, not universal
research optima. Tune springs in the installed runtime, not by copying Compose parameters.

| Event | Treatment | Non-negotiable behavior |
| --- | --- | --- |
| Press/select | Immediate visual response, small existing spring, selective haptic | Command dispatch does not wait for animation completion |
| Root switch | Immediate selected destination; no gratuitous tour across the screen | Stable destination, no remount/role reset |
| Open detail/back | Short directional continuity | Preserve source item, scroll and pending draft |
| Filter/preview sheet | Gesture-following spring with clear close/back | Interruptible, keyboard-safe, equivalent non-drag controls |
| Map selection | Camera adjusts only as needed to keep point visible above sheet | User gesture wins; restored map is not repeatedly recentered |
| New message | Small arrival only for actually new content | No reanimation of loaded history or forced bottom while reading older messages |
| AI draft change | Local highlight of changed field/container, then settle | Values appear accurately; no invented progress percentage or listening animation with inactive mic |
| Confirmed publication/Agreement | One restrained brand success sequence, then a useful receipt | Only after server confirmation; success is not a splash blocking the next action |

The installed Lottie renderer can support selected prepared assets; every asset needs its own license, tested
format, cost/weight, static fallback and exact trigger. Rive is optional and not installed: no dependency or paid
asset purchase is approved here. Do not replace the existing message engine with a hosted chat service to get
prettier bubbles. Figma is useful for decisions/components, but no remote canvas was edited in this task.

Runtime references checked separately: [Reanimated springs](https://docs.swmansion.com/react-native-reanimated/docs/animations/withSpring/),
[Gorhom sheets](https://gorhom.dev/react-native-bottom-sheet/), [Lottie RN](https://github.com/lottie-react-native/lottie-react-native),
[MapLibre camera](https://maplibre.org/maplibre-react-native/docs/components/camera/).
The Gorhom landing page's listed Reanimated versions and latest MapLibre examples are not substitutes for
checking installed package declarations and device behavior. No upgrade is implied by these links.

## 7. Execution order — coherent batches, not another restart

| Batch | Deliverable | Dependencies | Exit evidence |
| --- | --- | --- | --- |
| P0: continuity | DN-01 ownership/retry; non-destructive chat refresh; bounded rating-read failure handling; resolve keyboard/latest overlay | Existing contracts first; aggregate/read-boundary proposals separately | Meaningful regression tests for same-ID retry/account changes/outbox/late results; focused phone scenarios |
| P1: find and choose | Discovery/filter/pins → task detail → offer → candidate comparison/acceptance | P0 ownership; truthful local results retained until server parity proven | Same search scope and values all the way to final review; map/back/denial/remote/unknown cases |
| P2: create and prepare | Both AI conversations → existing structured editors → publication/worker review; place/photos/availability | Existing draft ownership and revision contracts; provider quality separate | Edit one fact without re-interview; unchanged other facts; draft survives Back/error; guarded review |
| P3: coordinate and finish | Agreement → messages/attachments/changes → completion/rating, linked Home and inbox | P0 refresh; paging+exact read boundary is separate server package | Two-party scenario incl. concurrent change, uncertain send, problem and legitimate completion |
| P4: trust and account | Public/private profile, safety/support, availability/calendar, permissions/auth, export/legal/closure UI | Trusted target identity; legal/operator material and execution capability | Find help, identify target, recover auth/form; authorized data only; destructive proof off DEV |
| P5: integrated finish | Cross-screen spacing/icon/motion/performance corrections and store readiness | P1–P4 plus independent release work | Current-source Android/iOS, two-phone golden journeys, accessibility and startup/offline checks; owner visual review |

Motion and empty/error/success states are implemented with each batch, then tuned together in P5. They are not
postponed until every screen is drawn. Allow a bounded composition comparison only for a real unresolved decision;
keep one runtime version. Do not create a new APK for each radius or color adjustment. Run types and full Jest
after each coherent runtime batch, then one attested APK and direct-phone review with targeted follow-ups.
Fix evidence-backed regressions; avoid repeating already-passed checks without new changes or concerns.

Server work runs as explicit separate proposals: filtered discovery with semantic parity and counts/cursors;
review aggregate; exact chat-read boundary with paging; rating comments including visibility/reporting/retention.
Candidate + disposable database proof precede any explicit owner “primeni”. Never silently weaken guards to speed UI.

Payments/PKG-051, provider/voice behavior, push delivery, operator/legal documents, retention/export execution,
production setup, iOS signing/device verification and store listing/disclosures stay release tracks. This plan
does not certify them or make them disappear behind visual progress. Full spoken AI is not inferred from dictation.

## 8. Blueprint reconciliation and scope decisions

Keep the blueprint's two golden paths, review-before-commit, private data boundaries and recovery. Apply later
owner-approved architecture: Zadaci combines map/list; the three-root bar is hidden inside focused flows; retired
routes remain redirects; current-location sharing remains removed; saving a place is its confirmation.

Proposed refinements, not new business rules: distinguish own tasks rather than excluding them; put existing
manual correction closer to the AI draft; improve Safety target identity and confirmation; use distinct task/offer/
Agreement composition. Source evidence and ownership scope must be respected before implementation.

Do not silently introduce hourly billing, subscriptions, escrow, insurance, “verified” badges, wishlists,
saved-search alerts, dispatch tracking or mandatory AI avatars. Research covers optional possibilities; it does
not grant authorization. Preserve approved HITNO behavior and pricing boundaries; do not invent urgency or fees.

## 9. Acceptance and a finite stop condition

The owner should be able to explain after each decision: what work, with whom, when, for what total/basis,
what is public and what happens next. Evidence must distinguish screenshots, source tests and actual execution.

Eight walkthroughs from the research become practical checks: discovery/back; AI correction/review; unequal-offer
comparison; proposed Agreement change; uncertain message; public/private place and denied GPS; accessible inputs/
large text; completion/problem/rating. Use isolated fixtures for layout, a disposable DB for synthetic business
proofs and existing owner-authorized real flows only where safe. Do not create fake DEV accounts or fabricate a
completed transaction. Voice needs the owner's readiness and no paid provider test without permission.

Candidate measures: successful completion, misunderstood totals/roles, repeated AI questions, lost context,
duplicate commands, response/frame stalls and perceived clarity. Set empirical baselines before numerical targets.
Do not promise “20% faster” from another study or send private messages/addresses into analytics.

Exit the redesign when the selected compositions work through the golden paths, blocking findings are resolved,
ordinary screens are accepted, the key interruption/large-text cases work, and no unresolved business capability is
disguised as complete. Later polish should solve a named problem rather than restart the visual identity.

## 10. Task receipt

This task creates a source audit, source-to-screen improvement plan and Serbian owner review. Runtime, server,
providers, dependencies and existing receipts remain unchanged. The final receipt records source coverage,
artifact validation, control refresh/publication and any limitations separately.
