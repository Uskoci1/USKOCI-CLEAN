# Inspected reference records

2026-09-20. These are bounded observations, not claims of complete app audits. Confidence concerns the stated observation. A screenshot is not a tested flow. A public help article is documented behavior, not visual inspection. No private USKOČI screenshot was uploaded.

<a id="r01"></a>

## R01 — Airbnb home via Banani

- **SOURCE:** Airbnb home via Banani
- **REFERENCE TYPE:** real product screenshot
- **SURFACE:** 01 HOME, 02 TASK_CARD, 15 NAVIGATION
- **OBSERVED PATTERN:** Search context, category rail and large photographic listing appear before most facts.
- **WHY IT WORKS:** Location is explicit before browsing.
- **WEAKNESSES:** Photo-first hierarchy is weak for tasks without photos.
- **DO NOT COPY:** Lodging imagery, favourites badge, category artwork or full arrangement.
- **USKOČI TRANSLATION:** Let the task scope and real timing lead; location remains easy to change.
- **SOURCE LOCATION:** [Original source](https://www.banani.co/references/screens/airbnb-home-screen)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser screenshot, upper viewport; 2026-09-20

<a id="r02"></a>

## R02 — Things 3 Today via Banani

- **SOURCE:** Things 3 Today via Banani
- **REFERENCE TYPE:** real product screenshot
- **SURFACE:** 01 HOME, 12 NOTIFICATIONS
- **OBSERVED PATTERN:** A dated focus view uses readable task rows and selective small secondary indicators.
- **WHY IT WORKS:** The next obligation is scannable without repeated containers.
- **WEAKNESSES:** Checkbox completion is not a marketplace lifecycle.
- **DO NOT COPY:** Its star branding or immediate one-tap task completion.
- **USKOČI TRANSLATION:** Home attention can use concise reason-led rows opening the authoritative subject.
- **SOURCE LOCATION:** [Original source](https://www.banani.co/references/screens/things-today)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser screenshot, upper viewport; 2026-09-20

<a id="r03"></a>

## R03 — Airbnb 2025 product release

- **SOURCE:** Airbnb 2025 product release
- **REFERENCE TYPE:** real product documented flow
- **SURFACE:** 01 HOME, 11 CHAT, 15 NAVIGATION
- **OBSERVED PATTERN:** The release describes coordinated discovery, trips, profiles and messaging across service types.
- **WHY IT WORKS:** A shared account can retain context across different intentions.
- **WEAKNESSES:** Travel categories and booking rules differ.
- **DO NOT COPY:** Trip taxonomy, proprietary illustrations or booking/payment behavior.
- **USKOČI TRANSLATION:** Use one account with two entry intentions and a shared work history.
- **SOURCE LOCATION:** [Original source](https://news.airbnb.com/airbnb-2025-summer-release)
- **CONFIDENCE:** MEDIUM
- **INSPECTION:** Official release text read; not live-app tested; 2026-09-20

<a id="r04"></a>

## R04 — Apple Tab Bars

- **SOURCE:** Apple Tab Bars
- **REFERENCE TYPE:** guideline
- **SURFACE:** 01 HOME, 15 NAVIGATION
- **OBSERVED PATTERN:** Tabs name stable destinations; action initiation has a different role.
- **WHY IT WORKS:** Stable labels reduce orientation cost.
- **WEAKNESSES:** Platform-specific presentation needs Android adaptation.
- **DO NOT COPY:** Exact glass geometry or treating create as a destination.
- **USKOČI TRANSLATION:** Keep destination identity while experimenting with composition and contextual create actions.
- **SOURCE LOCATION:** [Original source](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Official article text read; 2026-09-20

<a id="r05"></a>

## R05 — Apple Onboarding

- **SOURCE:** Apple Onboarding
- **REFERENCE TYPE:** guideline
- **SURFACE:** 01 HOME, 05 CREATE_TASK, 06 AI_INTERVIEW, 15 NAVIGATION
- **OBSERVED PATTERN:** Contextual teaching and postponing nonessential setup reduce the initial burden.
- **WHY IT WORKS:** People learn while doing a meaningful task.
- **WEAKNESSES:** Required USKOČI checks still apply.
- **DO NOT COPY:** Long compulsory tutorial or removing necessary consent.
- **USKOČI TRANSLATION:** Introduce only the next useful capability; let publishing and earning lead to relevant setup.
- **SOURCE LOCATION:** [Original source](https://developer.apple.com/design/human-interface-guidelines/onboarding)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser article read; 2026-09-20

<a id="r06"></a>

## R06 — Airbnb map via Banani

- **SOURCE:** Airbnb map via Banani
- **REFERENCE TYPE:** real product screenshot
- **SURFACE:** 04 MAP
- **OBSERVED PATTERN:** Price-labelled map pins, search/filter controls and category rail were visible.
- **WHY IT WORKS:** Some useful facts are available before opening a listing.
- **WEAKNESSES:** Top controls are dense; selected-preview behavior was not observed.
- **DO NOT COPY:** Per-night price meaning, artwork or assumed selected-sheet interaction.
- **USKOČI TRANSLATION:** Use truthful task labels and fewer controls; investigate selected-pin continuity separately.
- **SOURCE LOCATION:** [Original source](https://www.banani.co/references/screens/airbnb-home-screen-map)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser screenshot, upper viewport; 2026-09-20

<a id="r07"></a>

## R07 — Apple Maps

- **SOURCE:** Apple Maps
- **REFERENCE TYPE:** guideline
- **SURFACE:** 04 MAP
- **OBSERVED PATTERN:** Selection, readable annotations and keeping map content understandable are explicit concerns.
- **WHY IT WORKS:** Spatial context survives the act of choosing.
- **WEAKNESSES:** MapKit-specific APIs do not prescribe our provider.
- **DO NOT COPY:** Exact pin style or private-location precision.
- **USKOČI TRANSLATION:** Coordinate pin and preview selection while preserving public-location privacy and visible context.
- **SOURCE LOCATION:** [Original source](https://developer.apple.com/design/human-interface-guidelines/maps)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Official article text read; 2026-09-20

<a id="r08"></a>

## R08 — Apple Sheets

- **SOURCE:** Apple Sheets
- **REFERENCE TYPE:** guideline
- **SURFACE:** 03 TASK_DETAIL, 04 MAP, 05 CREATE_TASK, 09 APPLICATION, 10 AGREEMENT, 14 AVAILABILITY
- **OBSERVED PATTERN:** A scoped sheet needs understandable dismissal; stacking sheets confuses return context.
- **WHY IT WORKS:** Users can distinguish committing an edit from leaving it.
- **WEAKNESSES:** A prolonged interview needs more room than a small sheet.
- **DO NOT COPY:** Nested sheet chains, single Done-only exit, exact platform shape.
- **USKOČI TRANSLATION:** Use one focused edit surface; preserve draft and make cancellation truthful.
- **SOURCE LOCATION:** [Original source](https://developer.apple.com/design/human-interface-guidelines/sheets)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser article read; 2026-09-20

<a id="r09"></a>

## R09 — Material 3 bottom sheets

- **SOURCE:** Material 3 bottom sheets
- **REFERENCE TYPE:** guideline
- **SURFACE:** 04 MAP, 05 CREATE_TASK, 14 AVAILABILITY
- **OBSERVED PATTERN:** Standard and modal sheets have different interaction roles; the drag target is accessible.
- **WHY IT WORKS:** Choice of modality determines whether the map remains usable.
- **WEAKNESSES:** Its stock geometry is not USKOČI art direction.
- **DO NOT COPY:** Mechanical 28dp radius or a sheet as the whole product.
- **USKOČI TRANSLATION:** Define whether map context stays interactive; give handle and dismissal adequate targets.
- **SOURCE LOCATION:** [Original source](https://m3.material.io/components/bottom-sheets/overview)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser rendered overview read; 2026-09-20

<a id="r10"></a>

## R10 — Airbnb listing via Banani

- **SOURCE:** Airbnb listing via Banani
- **REFERENCE TYPE:** real product screenshot
- **SURFACE:** 02 TASK_CARD, 03 TASK_DETAIL
- **OBSERVED PATTERN:** The listing groups title, place, capacity and reputation beneath a large photo.
- **WHY IT WORKS:** Decisive facts are grouped before detailed description.
- **WEAKNESSES:** Hero photo consumes too much space for a text-led task.
- **DO NOT COPY:** Photo dependency, lodging metrics or ornamental trust claims.
- **USKOČI TRANSLATION:** Create a readable task brief with real place, time, amount and relevant person evidence.
- **SOURCE LOCATION:** [Original source](https://www.banani.co/references/screens/airbnb-listing-screen)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser screenshot, upper viewport; 2026-09-20

<a id="r11"></a>

## R11 — Taskrabbit hiring

- **SOURCE:** Taskrabbit hiring
- **REFERENCE TYPE:** real product documented flow
- **SURFACE:** 03 TASK_DETAIL, 05 CREATE_TASK, 07 WORKER_PROFILE, 09 APPLICATION
- **OBSERVED PATTERN:** Category and place lead to skills/reviews, availability, details and confirmation.
- **WHY IT WORKS:** Capability and availability precede commitment.
- **WEAKNESSES:** Its one-person invitation model differs from USKOČI.
- **DO NOT COPY:** Single-worker restriction, exact steps, rates or payment policy.
- **USKOČI TRANSLATION:** Expose capability and actual offer terms while retaining our multi-person task semantics.
- **SOURCE LOCATION:** [Original source](https://support.taskrabbit.com/hc/en-us/articles/46260422073755-How-Do-I-Hire-a-Tasker)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Official help article read; 2026-09-20

<a id="r12"></a>

## R12 — Things 3 compact task editing

- **SOURCE:** Things 3 compact task editing
- **REFERENCE TYPE:** real product screenshot
- **SURFACE:** 05 CREATE_TASK
- **OBSERVED PATTERN:** An expanded item edits title/notes while the list context remains visible.
- **WHY IT WORKS:** Editing focuses attention without a large preliminary form.
- **WEAKNESSES:** A personal to-do does not require marketplace publication review.
- **DO NOT COPY:** Silent save/completion rules or keyboard assumptions.
- **USKOČI TRANSLATION:** Use direct local fact correction followed by explicit whole-task review.
- **SOURCE LOCATION:** [Original source](https://www.banani.co/references/screens/things-new-task-filled)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser screenshot, upper viewport including keyboard edge; 2026-09-20

<a id="r13"></a>

## R13 — Apple Text fields

- **SOURCE:** Apple Text fields
- **REFERENCE TYPE:** guideline
- **SURFACE:** 05 CREATE_TASK, 06 AI_INTERVIEW, 09 APPLICATION
- **OBSERVED PATTERN:** Persistent labels, appropriate field size and logical focus support input.
- **WHY IT WORKS:** People retain field meaning after typing.
- **WEAKNESSES:** Does not decide the interview strategy.
- **DO NOT COPY:** Placeholder-only labels or fixed-height multiline input.
- **USKOČI TRANSLATION:** Clear units and labels; long Serbian input stays editable above the keyboard.
- **SOURCE LOCATION:** [Original source](https://developer.apple.com/design/human-interface-guidelines/text-fields)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Official article text read; 2026-09-20

<a id="r14"></a>

## R14 — ChatGPT focused input via Banani

- **SOURCE:** ChatGPT focused input via Banani
- **REFERENCE TYPE:** real product screenshot
- **SURFACE:** 06 AI_INTERVIEW, 11 CHAT
- **OBSERVED PATTERN:** Suggestions sit above a compact composer; microphone and voice controls are distinct.
- **WHY IT WORKS:** Input remains the immediate next action.
- **WEAKNESSES:** This is a historical screen; full voice is outside first release.
- **DO NOT COPY:** Model chooser, branding, voice button implying unsupported conversation.
- **USKOČI TRANSLATION:** Keep text and dictation modes clear and preserve unsent text while switching.
- **SOURCE LOCATION:** [Original source](https://www.banani.co/references/screens/chat-gpt-chat-focused)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser screenshot with keyboard edge; 2026-09-20

<a id="r15"></a>

## R15 — ChatGPT response via Banani

- **SOURCE:** ChatGPT response via Banani
- **REFERENCE TYPE:** real product screenshot
- **SURFACE:** 06 AI_INTERVIEW, 11 CHAT
- **OBSERVED PATTERN:** Speaker labels and open text blocks separate request and response.
- **WHY IT WORKS:** Long answers remain readable without nested panels.
- **WEAKNESSES:** A snapshot does not prove streaming or error behavior.
- **DO NOT COPY:** General chatbot chrome or long replies when a short question suffices.
- **USKOČI TRANSLATION:** Let interview dialogue breathe; show extracted facts only when useful.
- **SOURCE LOCATION:** [Original source](https://www.banani.co/references/screens/chat-gpt-chat-response)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser screenshot, upper viewport; 2026-09-20

<a id="r16"></a>

## R16 — Nova assistant concept

- **SOURCE:** Nova assistant concept
- **REFERENCE TYPE:** concept
- **SURFACE:** 06 AI_INTERVIEW, 11 CHAT
- **OBSERVED PATTERN:** Bubble conversation, quick suggestions and a composer appear in a static assistant concept.
- **WHY IT WORKS:** Prompt suggestions can reduce first-message effort.
- **WEAKNESSES:** Preview claims reminder completion without demonstrated operations; no live backend tested.
- **DO NOT COPY:** Decorative emoji bot, dark glow, unverified success language or source code.
- **USKOČI TRANSLATION:** Use optional starters only when draft is empty; never claim a saved result before confirmation.
- **SOURCE LOCATION:** [Original source](https://vp0.com/content/nova-ai-assistant)
- **CONFIDENCE:** MEDIUM
- **INSPECTION:** Browser opened preview; inspected upper conversation and AX contents; 2026-09-20

<a id="r17"></a>

## R17 — Google conversation design

- **SOURCE:** Google conversation design
- **REFERENCE TYPE:** guideline
- **SURFACE:** 05 CREATE_TASK, 06 AI_INTERVIEW
- **OBSERVED PATTERN:** Conversation design considers context, ambiguity and when simpler input is preferable.
- **WHY IT WORKS:** Questions can resolve only the information still missing.
- **WEAKNESSES:** Voice examples do not authorize speech output in our first release.
- **DO NOT COPY:** Chat for every numeric choice or repetitive requests for known facts.
- **USKOČI TRANSLATION:** Ask one useful question and offer direct correction of structured facts.
- **SOURCE LOCATION:** [Original source](https://design.google/library/conversation-design-intro)
- **CONFIDENCE:** MEDIUM
- **INSPECTION:** Official article text read; 2026-09-20

<a id="r18"></a>

## R18 — Airbnb person profile via Banani

- **SOURCE:** Airbnb person profile via Banani
- **REFERENCE TYPE:** real product screenshot
- **SURFACE:** 07 WORKER_PROFILE, 08 REQUESTER_PROFILE, 13 REVIEWS
- **OBSERVED PATTERN:** Identity and reputation totals share a compact evidence block above further profile content.
- **WHY IT WORKS:** Basic identity and supporting evidence can be read together.
- **WEAKNESSES:** Large enclosing card and travel metrics are not a worker skill profile.
- **DO NOT COPY:** Invented years, verification or ratings.
- **USKOČI TRANSLATION:** Place real reputation near identity, then skills and availability.
- **SOURCE LOCATION:** [Original source](https://www.banani.co/references/screens/airbnb-explore-profile)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser screenshot, upper viewport; 2026-09-20

<a id="r19"></a>

## R19 — Airbnb profile visibility

- **SOURCE:** Airbnb profile visibility
- **REFERENCE TYPE:** real product documented flow
- **SURFACE:** 07 WORKER_PROFILE, 08 REQUESTER_PROFILE
- **OBSERVED PATTERN:** Public profile information is distinct from private account information and viewing context.
- **WHY IT WORKS:** Identity can support trust without disclosing everything.
- **WEAKNESSES:** Its host/guest model is not a new USKOČI role switch.
- **DO NOT COPY:** Private details or irrelevant travel history.
- **USKOČI TRANSLATION:** Build public evidence from permitted fields; keep account/security controls separate.
- **SOURCE LOCATION:** [Original source](https://www.airbnb.com/help/article/3811)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Official help article read; 2026-09-20

<a id="r20"></a>

## R20 — Airtasker making an offer

- **SOURCE:** Airtasker making an offer
- **REFERENCE TYPE:** real product documented flow
- **SURFACE:** 09 APPLICATION
- **OBSERVED PATTERN:** An offer explains amount, included work and suitability.
- **WHY IT WORKS:** The decision has comparable terms rather than only a greeting.
- **WEAKNESSES:** Airtasker fees/escrow are outside our approved product model.
- **DO NOT COPY:** Payment assurance, bidding mechanics or their policy.
- **USKOČI TRANSLATION:** Show actual offered amount, timing and message with a final review.
- **SOURCE LOCATION:** [Original source](https://support.airtasker.com/hc/en-gb/articles/205056530-How-do-I-make-an-offer)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Official help article read; 2026-09-20

<a id="r21"></a>

## R21 — Airbnb reservation detail via Banani

- **SOURCE:** Airbnb reservation detail via Banani
- **REFERENCE TYPE:** real product screenshot
- **SURFACE:** 10 AGREEMENT
- **OBSERVED PATTERN:** A specific stay heading and property photo precede check-in/out details.
- **WHY IT WORKS:** The detail identifies the exact commitment.
- **WEAKNESSES:** Large media delays the next consequential action; lower controls not inspected.
- **DO NOT COPY:** Travel hero treatment, cancellation or payment assumptions.
- **USKOČI TRANSLATION:** Lead with exact task, participants and current next action; accepted terms remain readable.
- **SOURCE LOCATION:** [Original source](https://www.banani.co/references/screens/airbnb-reservation-details)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser screenshot, upper viewport only; 2026-09-20

<a id="r22"></a>

## R22 — Airbnb reviews via Banani

- **SOURCE:** Airbnb reviews via Banani
- **REFERENCE TYPE:** real product screenshot
- **SURFACE:** 07 WORKER_PROFILE, 08 REQUESTER_PROFILE, 13 REVIEWS
- **OBSERVED PATTERN:** Rating, distribution, review count and sorting are separate signals.
- **WHY IT WORKS:** A count gives context to an average.
- **WEAKNESSES:** Laurel badge and huge number overstate confidence for a new marketplace.
- **DO NOT COPY:** Guest-favourite award, fabricated distribution or unimplemented metrics.
- **USKOČI TRANSLATION:** Use only backend-supported reputation, explicit no-review state and readable contrast.
- **SOURCE LOCATION:** [Original source](https://www.banani.co/references/screens/airbnb-details-reviews)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser screenshot, upper viewport; 2026-09-20

<a id="r23"></a>

## R23 — Taskrabbit availability

- **SOURCE:** Taskrabbit availability
- **REFERENCE TYPE:** real product documented flow
- **SURFACE:** 07 WORKER_PROFILE, 14 AVAILABILITY
- **OBSERVED PATTERN:** Calendar days contain editable time blocks; invitation availability is a separate switch.
- **WHY IT WORKS:** Working intervals and accepting invitations are different decisions.
- **WEAKNESSES:** Its hour limits and calendar rules differ.
- **DO NOT COPY:** Specific limits or changes to our eligibility rules.
- **USKOČI TRANSLATION:** Explain saved intervals separately from current willingness to accept work.
- **SOURCE LOCATION:** [Original source](https://support.taskrabbit.com/hc/en-gb/articles/46260534523163-How-Do-I-Set-My-Availability)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Official help article read; 2026-09-20

<a id="r24"></a>

## R24 — Airbnb date selection via Banani

- **SOURCE:** Airbnb date selection via Banani
- **REFERENCE TYPE:** real product screenshot
- **SURFACE:** 05 CREATE_TASK, 14 AVAILABILITY
- **OBSERVED PATTERN:** Selected range has visible endpoints, summary and clear-dates action.
- **WHY IT WORKS:** Users can see the result of a range choice before leaving.
- **WEAKNESSES:** Overnight ranges are not recurring work availability.
- **DO NOT COPY:** Night counts or unavailable-date policies.
- **USKOČI TRANSLATION:** Give a human-readable time summary and reversible editing of the actual schedule.
- **SOURCE LOCATION:** [Original source](https://www.banani.co/references/screens/airbnb-booking-calendar)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser screenshot, upper viewport; 2026-09-20

<a id="r25"></a>

## R25 — Things 3 upcoming via Banani

- **SOURCE:** Things 3 upcoming via Banani
- **REFERENCE TYPE:** real product screenshot
- **SURFACE:** 12 NOTIFICATIONS, 14 AVAILABILITY
- **OBSERVED PATTERN:** Date groups and relative day labels organize upcoming items with separators.
- **WHY IT WORKS:** Time is scannable without a calendar grid.
- **WEAKNESSES:** Large empty gaps are wasteful for dense work schedules.
- **DO NOT COPY:** Day imagery or interpreting no tasks as available.
- **USKOČI TRANSLATION:** Offer a compact agenda view; distinguish unknown availability from free time.
- **SOURCE LOCATION:** [Original source](https://www.banani.co/references/screens/things-upcoming)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser screenshot, upper viewport; 2026-09-20

<a id="r26"></a>

## R26 — Apple Notifications

- **SOURCE:** Apple Notifications
- **REFERENCE TYPE:** guideline
- **SURFACE:** 12 NOTIFICATIONS
- **OBSERVED PATTERN:** Concise context-sensitive notification text is emphasized.
- **WHY IT WORKS:** An event can explain why it matters at a glance.
- **WEAKNESSES:** Excerpt-only evidence does not establish a full inbox or deep-link flow.
- **DO NOT COPY:** Assumed authorization, payload privacy or untested grouping rules.
- **USKOČI TRANSLATION:** Explain the event and open its exact subject while preserving access checks.
- **SOURCE LOCATION:** [Original source](https://developer.apple.com/design/human-interface-guidelines/notifications/)
- **CONFIDENCE:** LOW
- **INSPECTION:** Official search excerpt read; limited coverage; 2026-09-20

<a id="r27"></a>

## R27 — WCAG non-text contrast

- **SOURCE:** WCAG non-text contrast
- **REFERENCE TYPE:** guideline
- **SURFACE:** 13 REVIEWS
- **OBSERVED PATTERN:** Meaningful graphical controls require discernible contrast against adjacent colors.
- **WHY IT WORKS:** Rating choice can remain perceptible without guessing pale shapes.
- **WEAKNESSES:** Not every decorative border is an interactive component.
- **DO NOT COPY:** Color-only selected stars.
- **USKOČI TRANSLATION:** Use readable shape/edge plus selection state and accessible labels.
- **SOURCE LOCATION:** [Original source](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Official explanation read; 2026-09-20

<a id="r28"></a>

## R28 — Apple navigation presentation

- **SOURCE:** Apple navigation presentation
- **REFERENCE TYPE:** guideline
- **SURFACE:** 15 NAVIGATION
- **OBSERVED PATTERN:** Persistent destinations, hierarchical movement and focused modal tasks serve different purposes.
- **WHY IT WORKS:** Back behavior follows the type of transition.
- **WEAKNESSES:** An older iOS presentation is not an Android visual specification.
- **DO NOT COPY:** Hiding destinations during routine browsing or copying platform decoration.
- **USKOČI TRANSLATION:** Model destination, drill-down and temporary editor distinctly; verify native Back.
- **SOURCE LOCATION:** [Original source](https://developer.apple.com/videos/play/wwdc2022/10001/)
- **CONFIDENCE:** MEDIUM
- **INSPECTION:** Transcript portion read; video not watched; 2026-09-20

<a id="r29"></a>

## R29 — Material 3 navigation bar

- **SOURCE:** Material 3 navigation bar
- **REFERENCE TYPE:** guideline
- **SURFACE:** 01 HOME, 15 NAVIGATION
- **OBSERVED PATTERN:** Navigation destinations stay consistent; the flexible bar adapts to compact and medium windows.
- **WHY IT WORKS:** Destination continuity supports orientation across views.
- **WEAKNESSES:** Native ergonomics do not prescribe our brand shape or exact arrangement.
- **DO NOT COPY:** A dated baseline bar, automatic pill styling or role-based destination changes.
- **USKOČI TRANSLATION:** Compare stable labelled destinations at compact widths and under Android system navigation.
- **SOURCE LOCATION:** [Original source](https://m3.material.io/components/navigation-bar/overview)
- **CONFIDENCE:** HIGH
- **INSPECTION:** Browser rendered overview read; 2026-09-20
