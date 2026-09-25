# USKOČI — visual diagnosis after the R15 owner rejection

Date: 25 September 2026. Status: **analysis and proposed composition only**.
Owner direction: pause further visual implementation, inspect the actual result, use relevant design/motion skills,
and explain why a white app still feels lifeless. White remains the reading surface. Ordinary text must stay
proportionate, strong and legible. R15 is implemented and technically checked; **its visual quality is not accepted**.

## Evidence and limits

App source: `13bb55c0fb957bae723f4811a615926b92090ca6`. Documentation baseline: `d771c78d`.
Installed emulator APK: run `36150477204`; the R15 receipt binds its hash and source.
Normal baseline: emulator-5554, 1080 × 2424 px, density 420, font scale 1.0, no density override.

Fresh observations: Home and task AI conversation in inert galleries; live Discovery and its filter panel opened
read-only. The AI gallery menu is navigation evidence only. Re-examined the existing R15 task-card, Agreement-list
and real task-detail images from the same source. R15 also holds Agreement overview/long/missing-term captures.
This is a focused critique of these core compositions, **not a fresh native acceptance of all 40 destinations**.
Other screens retain the R11 inventory and their previously recorded evidence; see the coverage table below.

No app code, domain state, DEV, Edge, dependencies, microphone, paid AI, payment or device setting changed.
No new tests or APK were needed for this analysis. Previous source checks (314 suites / 6,114 tests and types)
belong to R15, not to a new run. Screenshots cannot establish frame rate, haptic quality or real AI response quality.
Gallery people, ratings and conversation text are fixtures, not DEV data or live provider output.

New local screenshots and XML:
`outputs/r6-integration/design-diagnosis-20260925/` in the outer Codex workspace.
[Capture receipt](CAPTURES.json) records their hashes, review scope and settings. Only the two inert product
screens are copied here; existing evidence is linked, not duplicated.

Visual evidence: [Home, inert](screens/home.png), [AI conversation, inert](screens/ai-thread.png),
[R15 task cards / Agreements and capture paths](../r15-distinct-work-surfaces-20260925/CAPTURES.json).
The report describes proposed changes; these images show the current app, not the proposed result.

## Diagnosis

The dominant problem is **weak hierarchy and repeated geometry**. White is already present. Many facts, labels,
cards, buttons and sections receive similar weight, generous padding and their own edge. Adding medium text,
colored icons and shadows independently has not produced a coherent consumer experience. The previous passes
overvalued consistency of components and legibility checks, and undervalued the composition of the finished screen.

White can have depth through real portraits/photos, precise edges, overlap that communicates a layer, restrained
shadows and purposeful colored objects. It does not require a mint canvas, background grain, decorative gradients,
or a shadow around every message. Strong text should distinguish the decision, not make every fact equally loud.

### Before / proposed after / reason

Every entry below is **open design work**, not an implemented fix.

| ID / priority | Before: observed result and source | Proposed after | Why / boundary |
| --- | --- | --- | --- |
| DD-01 / first | Task cards repeat title → place → date → requirement → terms → 56 dp initials. Two fully visible inert cards measure 827 and 918 px, approximately 315 and 350 dp. `TaskCard.tsx:72,119–130`, R15 cards image. | A work brief with one leading title/terms pair, a compact logistics group, a clear person row and context-specific next action. Optional real task media is evaluated separately; no permanent empty image slot. | Faster comparison without shrinking all text. Keep the actual date, price basis, people, material requirements and ownership indication; long text must wrap naturally. Do not impose a fixed card height. |
| DD-02 / first | TaskCard's CardPerson only draws initials although the opportunity projection has `narucilacProfilId`. Agreements and detail can already render ProfilePhoto. `TaskCard.tsx:72`, `TaskFace.tsx:234`, `ContextPhotos.tsx`. | Show the authorized public portrait when available, with the current honest fallback. | Human identity adds useful life. Existing ProfilePhoto starts its own read through useOwnedEditor; mass-mounting it needs bounded/reused reads and account-safe invalidation. Do not create an unbounded new request per feed row or use invented faces. |
| DD-03 / first | Discovery combines a large search pill, two circular tools, a full chip rail, zoom controls, three attribution labels, sheet count and a raised bottom bar. Regional clusters dominate the initial sparse map. Fresh Discovery capture; `DiscoverySearchBar.tsx`, `DiscoveryMap.tsx:339–349`. | Give search one clear entry, keep filter access obvious, quiet secondary tools, and make the selected marker and its preview the focal pair. Review road/park/water contrast at neighborhood and regional zooms. | Hierarchy rather than more decorations. Preserve all map credits, logo markers, measured camera padding, truthful clusters and approximate public locations. Sparse real data is not evidence of missing pins; no fake points for remote work. |
| DD-04 / first | The filter button opens a panel titled Pretraga with Kada? at 28 dp and closed condition rows around 88 dp. The broad list of conditions reads like a long form. `DiscoverySearchPanel.tsx`, fresh filter capture. | Search leads to place/words; filters lead to concise grouped conditions. Expose the current selection, clear/reset and one genuine result-count action. Focused date editing can expand locally. | A filter panel should help refine results quickly. Preserve draft/apply/cancel semantics and all existing conditions. Current public-place search works on loaded task labels; do not imply a new global geocoder or server-side search. |
| DD-05 / first | Detail promotes title, large location, split date/people, offer statement and publisher before the description. Fixed 24–28 dp group gaps accumulate. `PublicNeedPresentation.tsx:89–135,159–174`, `detail/TaskDecision.tsx`, R15 detail image. | A clear work heading; useful real photos when present; a compact logistics group; one price/offer block; immediately readable description and requirements; approximate map, questions and person context in a deliberate reading sequence. | Users need to understand the work before scrolling through a stack of equally important blocks. Maintain sticky context-sensitive action and every unknown/closed/own-task/recovery branch. “Cena nije navedena” remains ordinary text, not an amount. |
| DD-06 / second | Agreement list uses a 27 dp outer indent plus 27 dp inner padding and a vertical rail. Person, role, status, date, title, location and price each demand a row. It looks like an administrative timeline. `AgreementCollectionPresentation.tsx:302`, R15 list image. | A person-and-work appointment: strong work title, recognizable person, clearly grouped accepted time/place/total, and one visible next action. Remove the ornamental rail. | An accepted arrangement must feel distinct from a task advertisement without consuming a column on decoration. A progress track may display only real states; no fictional “dolazi” or payment status. |
| DD-07 / quick polish within second | The first Agreement segment is visibly faded at its left edge. Its container sets `fadingEdgeLength={24}`; underline selection changes a border immediately. `AgreementCollectionPresentation.tsx:265`, `Segmented.tsx:31–33,85–87`. | Legible edge labels and a measured selection indicator that moves when the person changes segment. | Removes a concrete visual defect and adds continuity. The fade's precise native behavior still needs a before/after check; keep selection semantics, count truth and reduced-motion behavior. |
| DD-08 / second | AI draft consumes roughly 569 px / 217 dp in the observed ordinary-text fixture, nearly a quarter of the whole screenshot. Every assistant turn repeats a raised box and AI asistent heading; the composer is another raised object. `AiConversationShell.tsx:129–195,265–297`, fresh AI image. | Conversation owns the screen; draft becomes a compact expandable summary; assistant answers have a quieter continuous reading style, with clear speaker identity; composer has one dominant text action and secondary tools. | More conversation space without losing draft review, unknown-outcome recovery or speech controls. Keep expanded details available; do not change the provider or judge live repetition from the fixture text. Keyboard anchoring remains R14-N01, independently open. |
| DD-09 / second | Home has two useful illustrated actions, then several strong section headings. Next appointment combines outline, shadow, internal divider and a green rail. `HomePresentation.tsx:54–114,269–333`, fresh Home image. | Preserve the two starts and attention-first purpose. Compose one clean upcoming appointment and quieter personal-list entries; remove redundant internal borders. | Keep useful original artwork and actual attention reasons. Artwork/detail should not compete with “what needs me.” No fabricated greeting, statistics or progress. |
| DD-10 / shared | The root navigation and circular chrome have substantial weight on a mostly empty map. Similar enclosures repeat elsewhere. `(app)/_layout.tsx:163–189`, `ScreenChrome.tsx`. | One consistent but quieter root navigator; context-specific back/tools; selected state unmistakable. Colored art for meaningful destinations, precise simple glyphs for commands. | Brand recognition and clear navigation can coexist with breathing room. Preserve root-only navigation, full labels, ordinary-size readability, safe areas and touch targets. Do not put the brand or a search control on every screen. |

The measured card bounds were [53,388–1028,1215] and [53,1252–1028,2170] in the R15 XML.
Density 420 means 2.625 physical px per dp. These are examples, not universal heights. The detail image has no
task photo; it does not establish that another user's photo is absent or unavailable.

## Composition choices before implementation

Three materially different approaches were considered for each core surface. These are alternatives to assess,
not multiple production variants or new routes.

| Surface / user's job | A | B | C | Selection and tradeoff |
| --- | --- | --- | --- | --- |
| Tasks: decide what merits opening | Photograph-led editorial feed | Dense text table | Compact work brief with optional media and human identity | C. A can be attractive but fails when a short job has no useful image; B scans quickly but feels administrative. |
| Map: relate jobs to place | Full map with one selected preview | List first with a map toggle | Search-led map with a resizable results sheet | C, already functionally supported. Borrow A's quiet selected state; avoid permanently crowding the map with all tools. |
| Filters: refine the current set | Long accordion questionnaire | Grouped conditions with focused date/place expansion | A new full-screen stepper | B. Keeps visible selection and result count while avoiding the feeling of creating a task. No new flow state machine. |
| Detail: decide whether to offer | Media-led page | Compact facts followed by work description | Large dashboard of equal fact tiles | A only when genuine photos help; otherwise B. C repeats the current hierarchy problem. One adaptable production composition. |
| Agreements: know what to do next | Person-led inbox row | Work appointment with person and next action | Calendar timeline as every card | B. A risks hiding the accepted job; C wastes width and implies a progression. Calendar remains a separate useful view. |
| AI: turn words into a task/profile | Chat with expandable draft | Full-page form and floating chat bubble | Draft-first dashboard with a short thread | A. B changes the product model and C repeats current crowding. Existing review and recovery remain. |
| Home: choose a start or attend to work | Large marketing hero | Activity-only dashboard | Two compact illustrated starts plus an attention agenda | C. It serves both roles and repeat visits; A delays useful work and B hides how to start. |

## What the reference products actually contribute

The seven owner-supplied Airbnb phone images are the strongest direct visual reference: white panels, varied
density, unmistakable selected controls, deliberate photo space, a clear filter footer and a map/results sheet.
They are not proof of animation timing, backend behavior or dimensions in dp. Our tasks often lack meaningful
photos, so their accommodation-card composition cannot be copied mechanically.

Airbnb's official release presents distinct Explore, Trips, Messages and Profile experiences.
The useful inference for USKOČI is that discovery, accepted work and conversation deserve different compositions.
[Airbnb release](https://news.airbnb.com/product-releases/airbnb-2025-summer-release)

Wolt's official redesign describes a clearer search/browse entry, nearby discovery, reachable controls and
transitions that maintain orientation. We borrow that hierarchy and continuity, not its commerce navigation.
[Wolt design update](https://press.wolt.com/en-WW/259625-wolt-app-updated-a-new-way-to-discover-everything-around-you/)

Uber describes shared foundations as a way to solve specific user problems while maintaining quality.
The inference here is to share type, controls and behavior without making every USKOČI screen look identical.
[Uber design account](https://jobs.uber.com/en/people-stories/inside-the-work/design-the-way-the-world-moves-for-the-better/)

Primary public sources and supplied screenshots were used. No paid Mobbin library, live authenticated competitor
app, Figma write workflow or commercial asset license was inspected in this audit.

## Skills and craft rules

Applied: mobile-app-ui-design (purpose/states/composition), design-taste (hierarchy and repeated-template audit),
emil-design-eng (interaction detail and before/after review), animate-expo (native motion and interruption).
They are judgment aids. The owner's latest direction overrides old USKOČI visual recipes and generic skill
prescriptions for tinted surfaces, oversized section spacing or identical cards.

- Keep the white canvas. Use depth to explain overlapping layers; keep ordinary reading groups largely open.
- Keep bundled Inter and ordinary scale. Tune weight and line length by role; strong title/action, calmer facts,
  readable secondary text. No blanket font increase, thin pale body text or fixed-height clipping.
- Use real people and media where authorized. Initials remain a valid absence/failure fallback.
- Use FactArt where it explains the action or fact. A back arrow, close control or filter glyph need not become
  a large illustration. Do not replace the owner's colored art with an all-gray generic icon set.
- Design normal data, missing price/photo, long text, loading, error, offline and confirmed success together.
  A skeleton or attractive empty illustration cannot masquerade as successful data.
- Keep cards structurally different by purpose, with consistent alignment and controls across the app.

## Motion proposal

Existing press feedback, Gorhom sheet, list entrances, native map camera easing and live reduced-motion handling
provide a working base. No new package is required to explore this next batch. This is a source assessment,
not a frame-rate or physical-phone result.

| Interaction | Proposed behavior | Evidence / verification needed |
| --- | --- | --- |
| Pin → task preview | Selected marker and sheet feel like one response; preserve drag/camera ownership | Existing map easing and measured sheet. Observe interruption and repeated taps. |
| Results ↔ map | Keep the spatial relationship as the sheet moves; no duplicate full-screen loading flash | Existing Gorhom sheet. Observe gestures and retained list position. |
| Condition/segment change | Measured indicator motion; layout stays stable while results update | Underline mode currently has no moving indicator. Do not animate fictional intermediate totals. |
| Draft expand/collapse | Compact summary grows into readable facts, then returns without losing the last message | New presentation proposal; verify keyboard/history anchoring and interruption. |
| True success | One brief check/confirmation when the authoritative result arrives | Never trigger on tap or optimistic send; unknown outcome keeps recovery. |
| AI waiting | Only actual processing animates; answer arrival is gentle and history stays still | Existing busy dots and turn entry. No idle ornamental loop. |

Start with existing timing tokens (roughly 120–360 ms depending on action), then judge the actual native feel.
These are starting points, not a rule forcing every transition to take the same time. Honor the user's system
Reduce Motion preference while normal mode remains fluid.

## Coverage and next work

| Surface family | This audit | Next focused work |
| --- | --- | --- |
| Map / filters / task cards / public detail | Current source and exact-source native evidence inspected | First coherent batch: DD-01–05, relevant shared chrome. |
| Home / Agreements / task AI | Current source and inert native evidence inspected | Second coherent batch: DD-06–10 and R14-N01 keyboard follow-up. |
| Worker AI | Shared shell inspected; its specific current native scene not recaptured | Apply conversation composition only after checking worker draft/review content. |
| Offer / candidates / public profile | R11–R15 historical inventory/evidence; no new full native review | Keep person/terms/message decision hierarchy; inspect within second batch. |
| Human/group/support chat | Historical R14 evidence, current keyboard finding remains open | Verify keyboard, long/photo recovery and context before accepting the new conversation family. |
| Auth / settings / notifications / place editors / legal/export | Existing inventory only in this audit | Targeted family pass after core composition stabilizes; no claim of fresh visual acceptance. |

For each implementation batch: inspect same-content native before/after at ordinary size, check a bounded narrow/
large-text case, run required types/full Jest once for the coherent code batch, build one APK, then device review.
Do not build for each spacing change. Recheck interrupted gestures, image failure and offline/recovery as relevant.
Do not label an implementation premium because tests pass. Capture specific owner acceptance separately.

No technical decision from the owner is needed to finish this diagnosis. Visual implementation was paused by the
owner and remains unstarted in this audit. The chosen compositions are the next implementation basis when work resumes.
Payment, provider/voice scope, performance findings, legal/store gates and whole-journey acceptance remain independent.

Control rows receive the rejection and next action without changing phone evidence or erasing functional findings.
The DEV snapshot stays dated 24 September. Remote dashboard publication remains unconfirmed after the documented
file-chooser timeout; local regeneration is not publication.
