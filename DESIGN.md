# USKOČI — design constitution

Date: 2026-09-20. **Proposed direction; not approved for implementation.**

This is the current root design authority. The older product-design-truth location points here. Git retains historical visual proposals. New owner instructions override the old role-based navigation, white-screen styling, fixed Home composition and rejected first Figma round.

## 1. Start with the product, not its old screens

**Preserve functional truth. Question visual legacy.**

USKOČI helps a person describe a task, find someone capable, make a clear agreement and follow the collaboration. The same person can publish and apply. The new experience must make those decisions feel understandable and dependable.

For every major surface, work in this order:

1. Write its responsibility, allowed facts, decisions and edge states without looking at its layout.
2. Research at least five relevant examples from three independent sources; use docs/design/references/00_REFERENCE_INDEX.md and record missing evidence honestly.
3. Compose at least three materially different ways of solving that problem.
4. Compare clarity, comprehension speed, distinctive character, thumb reach, trust, hierarchy, growth, visual quality and implementation cost.
5. Select or combine the strongest composition.
6. Only then inspect whether an old component's behavior or visual treatment deserves to survive.
7. Render states, review on devices, and implement only after the owner gate.

Code reuse is an engineering benefit, not a reason to retain weak composition. Moving an existing card to another position or changing its radius is not a new direction.

## 2. Brand character

A capable local helper: warm, clear, energetic, considerate and exact about commitments. Premium means excellent hierarchy, confident typography, useful detail and restrained craft. It does not mean expensive-looking effects.

The original USKOČI mark and recognizable entry assets remain brand resources. Their current size, surrounding layout and placement are not automatically inherited. Use the two main entry labels **OBJAVI ZADATAK** and **USKOČI I ZARADI**. Keep Serbian diacritics; do not expose internal role terminology.

Distinctiveness must survive removal of the logo and brand color. It should come from:

- a recognizable task anatomy: what, place, time and offer organized as a useful little brief;
- continuity from the map's selected task to that brief and then the agreement;
- an AI interview that visibly turns conversation into editable facts without becoming a form;
- a shared-work view that clearly distinguishes a proposal, an accepted agreement and a confirmed result;
- a consistent, small family of purposeful brand illustrations and interaction details.

No invented ratings, avatars, verification, urgency, precise location, payment protection or successful outcomes.

## 3. Provisional composition hypotheses — not a completed concept round

These verbal hypotheses preserve useful reasoning from the preparatory brief. They do not satisfy the three-rendered-concept requirement. Complete the relevant research gate before developing or selecting them in Figma. They have not been rendered or approved.

| Direction | Composition | Strength | Cost / risk |
|---|---|---|---|
| A — Local companion | Warm editorial canvas. Brief invitation and paired entry actions; current attention becomes a compact, highly legible work area. Map and conversation receive their own full-screen compositions | Strong balance of warmth, everyday usefulness, trust and visual identity; scales from no work to many obligations | Requires disciplined illustration and typography; can become decorative if the introduction grows |
| B — Nearby opportunities | Map dominates the initial experience; an attached task rail and a contextual create entry make locality the organizing idea | Immediate spatial understanding and recognizable marketplace presence | Remote work and returning users with agreements are less well served; map performance and permissions cannot become first-use prerequisites |
| C — Personal work journal | Chronological obligations and decisions dominate; a compact action bar starts new work; typography and dividers replace most containers | Fastest for repeat users, dense data, long text and weaker devices | Can feel administrative or visually austere before the first collaboration |

**Working hypothesis to test: A, with C's concise treatment of ongoing work and B's map/detail continuity inside discovery.** This is a coherent hierarchy, not a mixture of all three visual styles.

Qualitative evaluation:

| Criterion | A | B | C |
|---|---|---|---|
| First-use clarity | Strong: both purposes are explicit | Uneven: browsing dominates publishing | Uneven: little to show before activity |
| Repeat-use speed | Strong if attention appears early | Weaker for non-geographic obligations | Strongest |
| Distinctive brand | Strong editorial + product-specific art opportunity | Strong spatial opportunity | Depends heavily on typography and interaction |
| Thumb reach | Strong with deliberate lower actions | Good, but sheet/map gesture contention | Strong simple list actions |
| Trust | Balanced context and evidence | Requires deliberate non-map detail | Strong record-like presentation |
| Hierarchy | One current priority plus two stable entry paths | Competing pin, filter and creation controls need care | Clear obligations, less invitation |
| Many items / large type | Good with adaptive list layouts | Harder with map overlays | Strongest |
| Visual quality potential | High without requiring rich media everywhere | High with a useful map, weak without it | High if not reduced to plain utilitarian rows |
| Implementation realism | Existing native primitives are enough | Requires the most device/gesture work | Lowest rendering complexity |

## 4. Major-surface exploration

Each row starts with responsibility, then three distinct compositions. These are unrendered alternatives for later research-led evaluation, not final compositions. Rows whose research coverage is incomplete cannot advance to detailed design. Every suggested choice remains provisional; none preserves the old visual pattern by default.

| Surface / functional responsibility | Composition A | Composition B | Composition C | Recommended choice and trade-off |
|---|---|---|---|---|
| Home: start either activity and see what needs this account | Short editorial introduction; asymmetric paired actions; attention rows | Full map with two entry handles and a compact attention dock | Work journal with dated obligations; compact new-action bar | A + C's attention rows. Keep active obligations early; do not use huge decorative hero blocks |
| Navigation: reach all major destinations and return predictably | Three labelled destinations plus contextual profile/inbox entries | Four destinations with activities directly exposed; contextual create action | Two destinations with a persistent action dock and secondary work drawer | A provisionally: stable orientation, least reachability risk. Redesign its geometry from scratch; B needs a findability comparison, C hides too much work. Destination choice is reasoned, not inherited |
| Discovery: compare available tasks, spatially or as a list | Map canvas with compact search and attached selectable task tray | Editorial task list with a small expandable map region | Full task list/map modes joined by persistent query/filter summary | A for spatial discovery, C for list fallback. No forced map for remote tasks; no competing floating create action over selected detail |
| Task detail: judge scope, timing, location, terms and trust | Editorial brief, factual rows, person evidence and sticky action | Route/time-first itinerary with expandable work description | Single document-like brief with section index and bottom decision | A: strongest general use. B is useful for route tasks but cannot dictate every task. Real media only when supplied |
| AI intake and worker interview: understand answers and correct extracted facts | Conversation-first with one question, always reachable text/mic and compact facts shelf | Living brief fills the screen; the current question edits one portion | Guided voice stage with transcript and fact review beneath | A; borrow B only for an explicit review surface. C overstates voice for the dictation-only first release |
| Final task review / editing: inspect complete facts before publication | A readable task brief with local Edit links and final action | A step checklist with dedicated fact screens | A full editable form with anchored completion footer | A with B for complex location/time edits. C is useful as an accessible fallback, not the primary conversational journey |
| Application: make a precise offer without losing task context | Task summary followed by a compact offer form and review | Side-by-side conceptual task/offer comparison expressed as stacked mobile sections | Question-at-a-time offer interview | A: explicit numeric/time decisions with fewer hidden dependencies; B helps reviewing changed terms; C is unnecessarily slow here |
| Candidate choice: compare capabilities and actual offers | Comparable people rows; selected candidate opens a focused decision view | Horizontal profile cards, one at a time | Multi-column comparison expressed as a scrollable matrix | A with optional comparison disclosure. B impedes comparison; C risks tiny text and lateral scrolling |
| Activities / agreements list: understand pending decisions and ongoing work | Attention group then concise chronological rows | Separate task/application/agreement columns or tabs | One chronological stream with type filters | A, with C filtering. Avoid business-rule changes disguised as a new priority algorithm; no new server counts |
| Agreement workspace: know accepted terms and next permitted step | Current step, readable terms brief, accessible conversation and history | Chat-led screen with compact accepted-terms header | Timeline-led screen with each lifecycle event expanded | A with B's quick chat access. C is useful history, not the first thing an active participant should decode |
| Chat / group: read, send and recover with clear delivery truth | Familiar clean thread with compact agreement context and stable composer | Conversation below an expanded agreement brief | Message/event timeline with domain events mixed inline | A. B wastes keyboard space; C risks confusing system events with people's messages |
| Profile / reputation: decide who this person is and what they can do | Compact identity, capability groups, availability and real review evidence | Portfolio/media-led personal page | Evidence-first reputation ledger and work summary | A; selectively C for trust. B only where real relevant media exists, never stock stand-ins |
| Review: record eligible experience and show the immutable result | Focused rating, permitted tags, explicit submit, clear receipt | Conversational reflection then rating | Several separate rating steps with progress | A: least ambiguity and fewest steps; star controls must remain discernible without color alone |
| Auth / entry: understand service and enter safely | Original brand assets with concise benefit and staged native auth form | Product demonstration before authentication | Full-screen brand animation then a separate form stack | A. Optional demonstration must not delay returning users; no new credential or account behavior |
| Notifications: understand what changed and open the exact subject | Event rows grouped by readable time, reason and object | Inbox split by marketplace side | Mixed attention dashboard of big event cards | A with optional side filters. The account is not globally switched into a role |
| Settings / safety / support: perform a precise service action | Clear sections and compact information rows; focused forms | Search-first command menu | Large tiles for each capability | A; support remains conversational where it already is. Search cannot be added as a fake control; tiles waste space |

After each selected composition is drafted, record what survives from the old UI and why. Examples: draft preservation survives because it protects work; accessible Press behavior may survive because it works; a 22px bordered container does not survive merely because it is shared.

## 5. Spatial and visual language

**Proposed palette** — not yet changed in runtime:

| Role | Value | Use |
|---|---|---|
| Ground | `#FAF8F3` | Warm ivory canvas; do not turn every child into another white card |
| Surface | `#FFFFFF` | Input, sheet, meaningful raised region |
| Primary ink | `#183A30` | Headings, body, orange-button text |
| Brand green | `#176B55` | Orientation, selection and controlled brand emphasis |
| Secondary ink | `#586B62` | Readable supporting information |
| Action orange | `#FF850F` | Important action and sparse emphasis, not small text on light backgrounds |
| Semantic tones | Dedicated success / warning / danger pairs | Always accompanied by words or meaningful shape/icon |

Calculated sRGB contrast: ink/ivory 11.73:1; secondary ink/ivory 5.36:1; green/ivory 6.05:1; ink/orange 5.11:1; white/green 6.42:1. Orange/white is only 2.44:1: no small white text on orange or orange-only active control boundaries on white.

Normal text aims for at least 4.5:1. Meaningful control graphics and boundaries need 3:1 against adjacent colors where required; decorative hairlines are not all controls. Sources: [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). This calculation is not a complete accessibility audit.

Use a 4-unit rhythm with 8/12/16/24/32 for ordinary layout. Begin with 20-unit page margins at a 390-unit design width; allow 16 on compact layouts. Align headings, body and action labels to deliberate common axes. Use dividers and spacing before containers.

Proposed radius roles: 6 for a tiny inset/selection mark, 12 for fields and ordinary controls, 16 for a genuinely contained brief, 24 for a sheet's top edge. Circles belong to avatars, pins and truly circular controls. Do not apply these numbers mechanically to retained brand assets.

Minimum target policy for this product: 44 × 44 on iOS and 48 × 48 on Android; the visible glyph can be smaller. Avoid tiny mic/close/overflow controls. One primary action per local decision, not necessarily one colored button across a long page of unrelated decisions.

## 6. Typography

Start with native system fonts already available. No new font dependency or download is implied. Choose any custom family only after Serbian glyph, license, performance and owner review.

Proposed semantic scale: display 32/36 (rare, first-use only); screen title 26/32; section/title 20/26; body/input 16/24; supporting text 14/20; compact metadata 13/18. Use at most four of these in an ordinary viewport. These are starting values, not a ban on user font scaling.

Use weight, position, size and space together. Prices and dates use tabular numerals where supported, without losing the meaning of the amount or zone. Do not abbreviate decisive conditions into unexplained icons. Long Serbian labels wrap; essential terms never shrink to fit a fixed box.

Design at 390 × 844 logical units; verify 360-wide and 430-wide layouts, real safe areas and text scaling up to 200%. The existing phone screenshot's physical pixels are not design units.

## 7. Component character and art direction

**Task brief:** title leads, with place/time as a readable pair of facts, then actual amount/offer mode and people. Real urgency/requirements are selective signals. A compact row and map preview share information order, not necessarily the same enclosing card. A map preview must not contain another fully framed card.

**USKOČI pin:** identifiable silhouette derived from existing mark geometry, selected state visible through shape/edge/label as well as color. Do not encode invented exactness or invented prices. Clusters and off-map/remote work remain explicit.

**Agreement:** accepted terms read as a compact shared record; the current decision is separated from historical facts. No pseudo-escrow badge or false financial protection.

**AI:** conversation comes first. Facts gathered from it are inspectable and editable. The composer remains usable with an unsent draft, dictation, keyboard, errors and large text. No decorative assistant orb that suggests unsupported full voice conversation.

**Trust profile:** photo/initial, name and real signals compactly grouped; capability and availability appear early. No rating becomes a neutral sentence, not five empty stars implying a score of zero.

**Illustrations:** one small authored family drawn from task, locality and cooperation. Consistent perspective, line treatment and restrained dimensionality. A first-use illustration can explain an action; a populated work screen does not need the same illustration. Existing HTML art is an asset reference, not the quality ceiling. Never fill space with unrelated stock 3D objects. Any asset must have recorded source/license, editable source and native rendering plan.

Use existing Phosphor for interface icons; keep stroke/weight consistent. Brand illustrations and platform-required marks are separate categories, not excuses for multiple icon families.

## 8. Motion and native interaction

| Situation | Proposed behavior | Boundary |
|---|---|---|
| Press | Immediate tint/opacity or very small scale; 100–140ms release | No layout shift; disable haptic when the action is disabled |
| Navigation | Short platform-appropriate transition, approximately 180–240ms | Native Back and focus recovery remain correct |
| Sheet | Connected origin and controlled settle, approximately 260–320ms | Never fight map pan, keyboard or inner scroll; dismiss only when safe |
| Selected map task | Pin and preview update together | No fake route movement or hidden selected object |
| Expanded brief | Preserve reading anchor; expand only useful details | Large text can fall back to a dedicated screen |
| New message | Small one-time arrival cue when appropriate | Do not replay history or force scrolling away from what the user reads |
| Pending command | Honest progress then confirmed state | Success animation only after server confirmation |
| Reduced motion | Instant transition or minimal opacity feedback | Same information, focus and functionality |

These durations are hypotheses for device tuning. Existing Reanimated/Gesture Handler/haptics can supply normal interface motion. Rive/Lottie are optional for a specific authored asset, never a prerequisite for product quality.

## 9. State design and completion bar

Every important surface requires initial loading, refreshing, empty, partial, one/many, short/long text, error, offline, disabled, permissions, keyboard, compact/large screen, safe-area and large-text review where applicable. Explain N/A; do not silently skip.

Preserve last known facts during a refresh where safe, clearly distinguish unknown from zero and pending from saved. Empty states should explain the next useful action with modest visual weight. Success states should return the user to useful work.

For each implemented surface: launch → capture → inspect alignment/wrapping/hierarchy/contrast/targets/safe areas → fix → recapture. Add video observation for gestures and motion. Passing TypeScript or snapshot tests is not visual approval.

Final anti-generic check: would the composition still express task → person → agreement if the logo and colors disappeared? If not, revise it.

## 10. Approval boundary

The current phase authorizes a reference board in Figma, not redesigned product screens or runtime changes. After the owner reviews this setup, develop the next surface through its evidence gate and three compositions; record the selected direction before implementation. No backend semantics, new dependency, payment model or migration are approved by this document. See [DESIGN_SYSTEM_PLAN.md](docs/design/DESIGN_SYSTEM_PLAN.md) for the ordered work and exact file map.


## 11. Complete semantic roles (proposed, not installed)

These are light-theme starting tokens. Pair foreground/background deliberately; disabled state never carries essential instructions in unreadable text. New semantic colors require contrast checks when used, rather than assuming the whole palette passes.

| Token | Value / relationship | Meaning |
|---|---|---|
| background | #FAF8F3 | Continuous warm canvas |
| surface | #FFFFFF | Input or meaningful contained content |
| surface.raised | #FFFFFF + elevation.overlay | Overlay separated by depth, not another arbitrary tint |
| text.primary | #183A30 | Essential content |
| text.secondary | #586B62 | Supporting readable content |
| text.muted | #586B62 | Lower emphasis through placement/weight; no pale essential text |
| border.subtle | #D9DFD7 | Decorative grouping only; interactive edge needs stronger contrast |
| brand.primary | #176B55 | Brand orientation and selected context |
| accent | #FF850F with #183A30 text | Energetic action; not small orange text on ivory |
| success | #176B55 on #EAF3EE | Confirmed server result, with label |
| warning | #755000 on #FFF2D2 | Actionable caution, with reason |
| danger | #A12C32 on #FFF0ED | Consequence/error with explanation and recovery |
| information | #245E78 on #EEF6FA | Neutral information, not a success |
| disabled | #E4E8E1 with #586B62 text | Inactive control; explain why nearby where needed |

| Text role | Size / line | Weight / use |
|---|---|---|
| display | 32 / 36 | 700; rare, first-use |
| screen title | 26 / 32 | 700; compact relative to content |
| section title | 20 / 26 | 600–700 |
| card title | 18 / 24 | 600; task title, no artificial truncation of decisive meaning |
| body | 16 / 24 | 400 |
| secondary body | 14 / 20 | 400 |
| metadata | 13 / 18 | 500; not sole location of critical terms |
| caption | 13 / 18 | 400; accessible scaling |
| button | 16 / 20 | 600; enough vertical target padding |
| numeric emphasis | 20 / 26 | 700; real amount/count with units |
| status | 13 / 18 | 600; wording plus meaningful cue |

Shared values are deliberate. Semantic roles do not require eleven unrelated sizes. Native fonts remain default; Figma Roboto is an Android approximation, not an iOS render.

| Spatial role | Proposed rule |
|---|---|
| Screen gutter | 20; compact 16; safe-area inset added by one owner |
| Sections | 24 ordinary / 32 major change of responsibility |
| Contained brief | 16 internal; no redundant nested border |
| Rows | 12 vertical content spacing; minimum touch area still 48 Android / 44 iOS |
| Icon/label | 8 gap; 20–24 glyph inside full target |
| Field label | 8 to input, 4 to supporting text |
| Buttons | 16 horizontal; content-driven height, target minimum applies |
| Navigation | 8–12 internal separation plus actual system inset; never hardcoded to physical screenshot pixels |
| Sheets | 20 content gutter, 16 section spacing, actual lower inset; drag and close have targets |
| Forms | 16 between related fields / 24 between groups |

| Radius role | Value / rule |
|---|---|
| Small control | 6 |
| Input / button | 12 |
| Contained brief | 16, only when a container is justified |
| Sheet / large surface | 24 top edge / 16 contained surface; full page has no enclosing radius |
| Avatar | Circle; fallback uses the same occupied space |
| Pill | Fully rounded only for a truly compact status/filter; not default for all facts |

Elevation: normal content has none; an anchored transient control may use a restrained 0/2/8 shadow with low opacity; a modal sheet may use 0/8/24 with a scrim. These are tuning hypotheses, not required shadows everywhere. Android elevation and iOS shadow output must be compared on devices.

Haptics: one light selection response for an intentional discrete selection where useful; one confirmation response only after a consequential action is confirmed. No haptic on every render, loading tick, incoming history item, disabled press or failure retry loop. Respect device capabilities/preferences; all meaning remains visible without vibration.

## 12. Permanent evidence and approval memory

Read [current truth](docs/design/CURRENT_UI_TRUTH.md), [source registry](docs/design/REFERENCE_SOURCE_STATUS.md), [reference groups](docs/design/references/00_REFERENCE_INDEX.md), [Figma index](docs/design/FIGMA_REFERENCE_INDEX.md), [screen inventory](docs/design/SCREEN_INVENTORY.md), [visual audit](docs/design/VISUAL_LEGACY_AUDIT.md) and [UI debt](docs/design/UI_DEBT.md). A public resource is not an imported asset or connected MCP. Preserve original artwork provenance, and distinguish a screenshot, documented behavior and a tested flow.

Record each future approval with date, exact Figma node IDs, state coverage and implementation scope. All current new screen proposals remain unapproved. Realistic Serbian design specimens are allowed locally and on the reference/design board if labelled as specimens; they must never become fake DEV data or invented user reputation.

The visual QA loop covers alignment, spacing, hierarchy, wrapping, proportions, contrast, icon meaning, touch targets, safe areas, keyboard, Back, scrolling, sheet heights, competing gestures, map continuity, loading, empty/error/offline, long content and actual permitted data. Use connected Android first, then named additional devices. Orientation support is verified against the app configuration; do not promise landscape before checking it.
