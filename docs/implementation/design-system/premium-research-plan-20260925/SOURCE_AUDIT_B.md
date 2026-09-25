# Independent source audit: S26–S50

Audit date: 25 September 2026. Scope: the 25 bibliography entries extracted into `sources.json` from `USKOCI_MOBILE_UX_RESEARCH_2026_v1.docx`. This audit checks the source findings and their stated limits, rather than validating the existing application or proving that the original document's author accessed the sources.

All 25 primary sources were independently accessed and their relevant passages read. Twenty-three were readable as public HTML. Apple S43 and S49 returned JavaScript-only HTML; their official Apple documentation JSON was accessible and was read instead. No source remained unavailable. No accounts, transactions, private app screens, native runtime builds, or performance tests were used.

The central findings are supported. Three entries need explicit precision when incorporated into a new plan: S33's June 2026 update is a CSS maintenance fix, S35 has an Airbnb-friendly building-address exception, and S44 does not itself mandate a list alternative to every map. None of these sources selects USKOČI's business model, visual identity, palette, typography, commercial providers, or roadmap.

## S26 — Android Compose: Customize animations

**Status: verified, platform scope retained.** [Primary source](https://developer.android.com/develop/ui/compose/animation/customize). Read the spring and tween sections; page displayed an update date of 22 September 2026.

**Supported finding:** Compose's spring animation preserves velocity continuity when its target changes during an animation, supporting smoother interruption than duration-based specifications. Damping and stiffness control different aspects of its behavior.

**Limits:** This is documentation of Compose behavior, not a controlled study proving springs universally superior. The JSON caveat about transferring runtime parameters is appropriate. Values from Compose cannot be assumed equivalent in React Native, CSS, SwiftUI, Rive, or dotLottie.

**USKOČI implication — proposal:** Use interruption-friendly motion for direct manipulation and expanding surfaces. Specify the intended response and interruption behavior before choosing runtime values. Rapid repeated taps, reversal, and dismissal must be part of prototype acceptance. No new animation library is required by this source.

## S27 — Android: Request runtime permissions

**Status: verified.** [Primary source](https://developer.android.com/training/permissions/requesting). Read basic principles, request workflow, rationale, and denial handling.

**Supported finding:** Request access when the person invokes the relevant feature, explain why when appropriate, allow dismissal of educational UI, and degrade gracefully after refusal or revocation. The example explicitly rejects using a Settings link to pressure someone to reverse a denial.

**Limits:** Some resources have special permission processes. A rationale is conditional, not an obligatory extra screen before every system prompt. Platform guidance does not itself decide what location precision USKOČI needs.

**USKOČI implication — proposal:** Ask for location from the nearby-search action and for camera access from taking a photograph. Offer manual location entry and preserve unrelated browsing and drafts. Distinguish first request, denial, permanent denial, and revoked access without coercive repeat prompts.

## S28 — Android: Notifications

**Status: verified.** [Primary source](https://developer.android.com/design/ui/mobile/guides/home-screen/notifications). Read channels, categories, importance, grouping, lock-screen visibility, and style. Page displayed 2 March 2026.

**Supported finding:** Channels let users control visual and audible interruption. Importance should reflect genuine urgency. Categories aid system handling, while sensitive notification content can be concealed on a locked device.

**Limits:** These are Android system capabilities and conventions, not freedom to replace the notification surface with arbitrary branded UI. The document's caveat is sound. Push delivery, user permission, and app-level read state are separate matters.

**USKOČI implication — proposal:** Define separate preferences for messages, agreement changes, reminders, and optional discovery content. Reserve urgent treatment for time-sensitive events. Avoid displaying precise home addresses or sensitive task details in public previews; take notification taps to the relevant object and current state.

## S29 — Android: Photo picker

**Status: verified.** [Primary source](https://developer.android.com/training/data-storage/shared/photo-picker). Read introduction, availability, selection limits, and persistent media access.

**Supported finding:** The system picker grants an app access to selected photos or videos instead of the entire library. Access persistence and fallback behavior require implementation attention.

**Limits:** Selection is a local access result, not successful upload or server processing. Availability depends on platform and system modules; fallback selection limits may differ. The source is Android-specific and does not validate the iOS implementation.

**USKOČI implication — proposal:** Separate selected, uploading, processing, ready, and failed image states. Preserve the draft if one photo fails and expose retry or removal on that photo. Do not show an upload success checkmark immediately after a picker returns. Decide supported formats and limits independently.

## S30 — Android: Build an offline-first app

**Status: verified.** [Primary source](https://developer.android.com/topic/architecture/data-layer/offline-first). Read write strategies and synchronization/conflict resolution.

**Supported finding:** Offline reading, local data, synchronization, and conflicting updates need explicit architecture. The source distinguishes online-only, queued, and local-first writes. An offline-first app need not support offline writes.

**Limits:** The source discusses last-write-wins as one strategy, not a suitable default for every transaction. Its queue examples do not justify silently committing a financial or contractual action later. The document's business-command caveat is important.

**USKOČI implication — proposal:** Preserve drafts and recently viewed information locally. Make pending message delivery distinguishable from delivery confirmed by the service. Treat offer acceptance, agreement changes, cancellation, and completion according to their authoritative business rules; a local optimistic screen must not invent a completed agreement. Define retry and conflict recovery explicitly.

## S31 — Android: Build a list-detail layout

**Status: verified.** [Primary source](https://developer.android.com/develop/adaptive-apps/guides/list-detail). Read layout description, window adaptation, and back-navigation behavior. Page displayed 22 September 2026.

**Supported finding:** A list and its selected detail can coexist on wider windows or appear one at a time on smaller windows. The implementation also addresses selection restoration and alternative back-stack policies.

**Limits:** This is an adaptive layout pattern and Compose implementation, not a rule about task-card contents, marketplace rights, or mandatory tablet scope. Different back behaviors must be selected deliberately.

**USKOČI implication — proposal:** Retain task selection and list position when opening and leaving a detail. If tablet support is in scope, use the additional space for list and detail together while preserving the same conceptual navigation. Define behavior after rotation, window resizing, deep linking, and keyboard dismissal.

## S32 — GOV.UK: Check answers

**Status: verified.** [Primary source](https://design-system.service.gov.uk/patterns/check-answers/). Read usage, submission clarity, and changing answers.

**Supported finding:** Review information before submission, offer direct section editing, prepopulate earlier answers, and return to the review after an edit. Newly required dependent questions can appear before that return.

**Limits:** GOV.UK describes a service transaction pattern. Its desktop geometry, exact wording, and web components are not native mobile requirements or evidence for adding a review step to every trivial action. The document correctly distinguishes principle from copied component.

**USKOČI implication — proposal:** Before publishing a task or accepting consequential terms, show the actual scope, amount basis, time, location disclosure, and participants supported by the business model. Each editable group should return directly to this summary. Use a final action label that accurately states the commitment.

## S33 — GOV.UK: Error summary

**Status: verified; date context should be clarified.** [Primary source](https://design-system.service.gov.uk/components/error-summary/). Read use, focus, links, wording, and recent changes.

**Supported finding:** The component links each error to the relevant answer, matches the wording beside the field, and directs focus to the summary. The change history does include June 2026.

**Precision:** That June entry fixes duplicated list CSS output in GOV.UK Frontend v6.2.0. It is not a new research finding or a new universal validation rule. The requirement to always display this component is within the GOV.UK design system.

**USKOČI implication — proposal:** Preserve completed values, show actionable field errors, and move accessibility focus to useful error information. In a long form, a compact linked summary may help; in a one-field native sheet, a direct field message may be clearer. Test with the keyboard open and with screen readers.

## S34 — Airbnb: Search for home listings

**Status: verified as a product example.** [Primary source](https://www.airbnb.com/help/article/252). Read destination search, map use, dates, and filters.

**Supported finding:** Airbnb documents destination, date, and criterion-based search. Panning and zooming can expose listings not initially visible. The public article contains usable content despite a generic JavaScript notice.

**Limits:** This supports the existence of documented functionality, not an exhaustive inspection of current app variants or proof that map-first search beats list-first search. A lodging date range is not automatically the right representation for local work.

**USKOČI implication — proposal:** Keep location, timing, and filters understandable in both map and list contexts. Preserve the selected task while changing view. Explicitly communicate whether panning changes results immediately or requires a search action. Choose the default view through task-based evaluation, not competitor prestige.

## S35 — Airbnb: Customize your map location

**Status: verified with a material qualification.** [Primary source](https://www.airbnb.com/help/article/2141). Read public-location modes and the Airbnb-friendly program caveat.

**Supported finding:** Hosts can enable a precise public pin or show an approximate area. The normal listing flow withholds its numerical street address until reservation confirmation.

**Precision:** The article additionally states that a precise location in the Airbnb-friendly program can associate the listing publicly with a building's name and address. Unit number remains tied to confirmation. Thus “full address only after confirmation” should not be presented as an exception-free rule for all Airbnb contexts.

**USKOČI implication — proposal:** Define public area, participant-only address, and any exceptional public business address separately. Label approximate locations honestly. The disclosure moment must follow USKOČI's agreed privacy and transaction policy; it cannot be selected merely by copying a pin design.

## S36 — Taskrabbit: How Do I Hire a Tasker?

**Status: verified as a product example.** [Primary source](https://support.taskrabbit.com/hc/en-us/articles/46260422073755-How-Do-I-Hire-a-Tasker). Read app flow, profile information, scheduling confirmation, and the two-Tasker restriction.

**Supported finding:** Category and address lead to profiles, availability, hourly price, experience, and category reviews. Taskrabbit explicitly requires separate hiring rather than requesting two Taskers with one invitation. Its app description distinguishes the customer's confirmation from scheduling on the Tasker's side.

**Limits:** This is one marketplace's published business flow, not a reason to make USKOČI hourly, single-provider, or fixed to the same booking window. The original caveat is well grounded.

**USKOČI implication — proposal:** Use consistent comparison attributes where relevant, including price basis and scope. Preserve USKOČI's chosen individual/team semantics and show actual confirmation status. A team offer needs its own validated participant and responsibility model rather than two visually merged single-person bookings.

## S37 — Airtasker AU: How it works

**Status: verified as an Australian product example.** [Primary source](https://www.airtasker.com/au/how-it-works/). Read task description, budget, offers, communication, payment, and insurance passages.

**Supported finding:** Posting a need and budget leads to quotes and selecting a Tasker. After accepting an offer, private messaging is available. The page also describes its payment holding/release mechanism and qualified insurance coverage.

**Limits:** These are Airtasker's documented functions and commercial claims. They do not show that USKOČI offers escrow, insurance, verified bank accounts, or the same review verification. The cited flow is not independent evidence of superiority or the latest exact UI.

**USKOČI implication — proposal:** A clear need → comparable offers → selected agreement flow is a reasonable candidate. Keep offer scope and total meaning visible. Do not add protection badges, payment guarantees, or insurance language without the actual service and rules behind them.

## S38 — Figma: Guide to variables

**Status: verified, tool capability only.** [Primary source](https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma). Read reusable values, modes, design systems, and advanced prototyping.

**Supported finding:** Variables store reusable property values and prototype state. Modes support context changes such as theme; expressions and conditionals can support richer interactive prototypes.

**Limits:** A variable-driven design is not automatically usable, accessible, or equivalent to a production implementation. Availability of prototype features and publishing depends on the plan and access described by Figma. The source does not mandate using Figma.

**USKOČI implication — proposal:** If Figma is the delivery tool, create semantic color, type, spacing, and state variables around the retained identity. Model errors, long Serbian text, pending states, and alternate appearances explicitly. Keep the visual source of truth aligned with implementation decisions through a documented token map.

## S39 — Design Tokens Community Group: Format Module 2025.10

**Status: verified; classification is correct.** [Primary source](https://www.designtokens.org/tr/2025.10/format/). Read abstract, status, and token organization.

**Supported finding:** The module defines a format for exchanging design tokens between tools. It describes itself as stable and intended for implementation while explicitly stating that it is neither a W3C Standard nor on the W3C Standards Track.

**Limits:** The title “Candidate Recommendation” in its community process must not be shortened into “W3C Recommendation.” A compatible file format does not determine good colors, hierarchy, spacing, or accessibility, and does not ensure every tool imports every field.

**USKOČI implication — proposal:** Give retained brand values semantic aliases for roles such as primary action, readable foreground, surface, warning, and focus. Record sources and platform mappings so visual refinement remains consistent. Choose concrete values through design and contrast checks, not by claiming the interchange specification endorses them.

## S40 — Rive: State Machine Overview

**Status: verified; runtime parity remains untested.** [Primary source](https://rive.app/docs/editor/state-machine/state-machine). Read overview and anatomy.

**Supported finding:** Rive's editor connects animations through states, transitions, and layers. The page explains state graphs and interactive content states.

**Limits:** This overview is not a compatibility matrix for specific iOS, Android, React Native, or web runtime versions. It does not establish accessible control semantics, server truth, transaction logic, load cost, or physical-device performance. The source's UI examples do not make an animated canvas a replacement for native controls.

**USKOČI implication — proposal:** Rive is an optional candidate for a branded illustration or assistant with multiple visual states. Application state should drive its presentation; an animation reaching “success” must never complete a business action. Keep labels and actionable controls accessible, provide a still/reduced-motion treatment, and verify the chosen runtime before commitment.

## S41 — LottieFiles: State machines in dotLottie Web Player

**Status: verified; web/version boundary is essential.** [Primary source](https://docs.lottiefiles.com/en/runtimes/distributions/js/v0.x/state-machines). Read definition, transitions, inputs, lifecycle, and events. Page displayed 11 September 2026.

**Supported finding:** The documented JavaScript player loads state machines authored in the `.lottie` file and drives them with inputs and events. Its tween transitions block new state changes until they finish.

**Limits:** This URL explicitly addresses the Web Player v0.x documentation branch. It does not establish identical native Lottie, native dotLottie, React Native, or Creator API support. Blocking is the state-transition behavior described here; it is not evidence that the entire host UI must block.

**USKOČI implication — proposal:** Treat Lottie/dotLottie as optional animation tooling. Keep submission, cancellation, and error handling outside the animated asset. For a responsive assistant, verify rapid successive events and interruption behavior in the exact selected runtime. Preserve an accessible static state if the asset fails or motion is reduced.

## S42 — W3C Understanding 2.3.3: Animation from Interactions

**Status: verified; AAA distinction retained.** [Primary source](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html). Read criterion, intent, examples, and motion definition.

**Supported finding:** Interaction-triggered nonessential motion animation can be disabled. This criterion is Level AAA. The page is informative guidance explaining the criterion, not itself the normative standard.

**Limits:** Automatically started animation has related requirements elsewhere. Essential motion is excepted. This single criterion should not be used as a blanket assertion that all animation is forbidden or that an app is AA-compliant. Native applicability requires the relevant platform and non-web guidance.

**USKOČI implication — proposal:** Adopt reduced motion as an internal quality requirement even when AA is the stated web target. Replace large movement, parallax, and decorative looping with calm alternatives while preserving status information. Test navigation and the optional brand character with system motion preferences enabled.

## S43 — Apple HIG: Color

**Status: verified through official Apple JSON.** [Human-readable source](https://developer.apple.com/design/human-interface-guidelines/color); [official content read](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.json). HTML was JavaScript-only. Read contextual appearance, inclusive color, and semantic system colors.

**Supported finding:** Colors need sufficient contrast and appropriate appearance variants. Meaning should not rely only on color; text or shape can carry the same information. Semantic color roles should remain consistent.

**Limits:** Apple does not declare a universally optimal trust color for marketplaces. Platform system colors can vary; hard-coded copies are not equivalent to using semantic APIs. The guidance does not require discarding a brand palette.

**USKOČI implication — proposal:** Preserve recognizable brand color roles while adjusting inaccessible foreground/background pairs. Add text and icon cues to statuses. Validate light, dark where supported, increased contrast, imagery, translucent overlays, and real lighting conditions. A status color must have the same meaning across task, offer, and agreement surfaces.

## S44 — W3C Understanding 2.5.8: Target Size (Minimum)

**Status: verified; the map-list statement is a proposal.** [Primary source](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Read criterion, spacing rules, and exceptions.

**Supported finding:** This AA criterion specifies at least 24 × 24 CSS pixels or a qualifying exception. Exceptions include spacing, equivalent targets, inline content, unmodified user-agent controls, and essential presentation. Map-pin positioning is a documented essential example.

**Precision:** The source does not itself require every map to have a list. A list is a useful proposed alternative, and other accessibility needs remain; do not attach that claim directly to this target-size rule. CSS pixels are not physical pixels or native dp/pt.

**USKOČI implication — proposal:** Use comfortable platform-appropriate touch areas around smaller icons. Audit overlapping targets, dense chips, close controls, and markers. Provide equivalent task access through a list because it improves discovery and access, without mislabeling that design choice as the wording of 2.5.8.

## S45 — W3C Understanding 3.3.8: Accessible Authentication (Minimum)

**Status: verified with scope precision.** [Primary source](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html). Read criterion, assistance mechanisms, login forms, copying/pasting, and recovery.

**Supported finding:** This AA criterion allows assistance such as password managers and pasting, or a non-cognitive alternative. It addresses authentication steps, including applicable recovery paths. The minimum criterion has object-recognition and personal-content exceptions.

**Limits:** It primarily addresses existing-user authentication, rather than initial account creation, although the techniques are useful there too. It does not mandate a particular provider, passkeys, or SMS. A pasted multi-digit code must remain usable; visually separate cells must not make transcription mandatory.

**USKOČI implication — proposal:** Support autofill and whole-code paste, clearly describe expired codes, preserve the destination after authentication, and provide understandable recovery. Test the complete sign-in and recovery route with assistive technology. Provider and authentication-method decisions require product and security evaluation beyond this page.

## S46 — Android: Slow rendering

**Status: verified; implementation measurement required.** [Primary source](https://developer.android.com/topic/performance/issues/render). Read frame timing, jank identification, visual inspection, and diagnostic guidance.

**Supported finding:** Available rendering time tightens as refresh rate increases; the page gives approximate 16/11/8 ms windows for 60/90/120 fps. It recommends release-like testing, tracing, and slower devices to diagnose jank.

**Limits:** These are performance guidance and approximations, not evidence that a prototype reaches them. Much of the diagnostic detail addresses Android's View system and links separately to Compose performance. It cannot establish performance in another runtime without measurement.

**USKOČI implication — proposal:** Verify scrolling, map interactions, keyboard opening, sheets, image-heavy tasks, and animated assets in a release build on representative physical phones. Capture visible stutter and input latency with the appropriate platform tools. Scale down costly effects when needed while retaining information hierarchy and brand character.

## S47 — W3C Understanding 2.5.7: Dragging Movements

**Status: verified; wording can be more precise.** [Primary source](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html). Read criterion, single-pointer alternatives, user-agent scope, and examples.

**Supported finding:** This AA criterion requires a single-pointer method without dragging, except essential dragging or unmodified user-agent functionality. Single pointer includes mouse, pen, or one touch; “one finger” is a narrower paraphrase.

**Limits:** Keyboard accessibility is related but independently assessed. A keyboard-only alternative does not automatically satisfy a touch/pointer alternative. The criterion does not ban all gestures or require replacing normal user-agent scrolling.

**USKOČI implication — proposal:** Photo ordering can offer move-left/move-right actions; radius controls can accept a value or taps; custom map panning can have equivalent controls or an appropriate alternate route. Make sheet dismissal available through a clear action as well as a drag. Test equivalence of outcomes, not just existence of extra buttons.

## S48 — W3C Understanding 1.4.11: Non-text Contrast

**Status: verified.** [Primary source](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Read criterion, control identification, states, inactive controls, and input examples.

**Supported finding:** Necessary visual information identifying controls, states, and meaningful graphical content generally needs at least 3:1 contrast against adjacent colors, with defined exceptions. Inactive controls and unmodified user-agent appearances are treated separately.

**Limits:** Decorative separators do not automatically carry the same obligation as the only boundary identifying an input. The criterion does not require 3:1 between every pair of a control's temporally separate states, or make all pale decoration invalid. Do not round a failing computed ratio upward.

**USKOČI implication — proposal:** Audit icons, selected controls, input boundaries when needed for identification, focus indicators, map symbols, and status graphics. Use actual adjacent pairs, including overlay backgrounds. Retain subtle decorative surfaces where they do not hide essential information; avoid equating “premium” with faint critical controls.

## S49 — Apple HIG: Progress indicators

**Status: verified through official Apple JSON.** [Human-readable source](https://developer.apple.com/design/human-interface-guidelines/progress-indicators); [official content read](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/progress-indicators.json). HTML was JavaScript-only. Read determinate/indeterminate types and best practices.

**Supported finding:** Use determinate progress when possible and represent advancement accurately. Indeterminate feedback communicates activity without estimating remaining work. A stalled operation needs an explanation and a useful next step; cancellation is appropriate when feasible.

**Limits:** The advice to smooth progression or keep activity visible does not justify a fabricated percentage or hiding failure. A process becoming measurable can change from indeterminate to determinate, while unnecessary shape changes can be disruptive.

**USKOČI implication — proposal:** Separate photo transfer from processing and task submission. Show measurable progress only when the underlying stage can supply it. Provide an honest waiting state for unknown duration, and actionable timeout, retry, or cancellation behavior. Announce actual success only after the relevant service confirms it.

## S50 — Google Maps: Marker Clustering Utility

**Status: verified; provider choice remains open.** [Primary source](https://developers.google.com/maps/documentation/android-sdk/utility/marker-clustering). Read introduction, zoom behavior, cluster manager, and customization.

**Supported finding:** The Android utility groups markers as the map zooms out and displays individual markers at closer levels. Its cluster renderer is customizable.

**Limits:** This documents an Android SDK utility, not a mandate to select Google Maps or proof of identical behavior in all web/native wrappers. A cluster count reflects the items supplied to clustering; this page does not guarantee that those items exhaust the server's search results.

**USKOČI implication — proposal:** Use clustering when density warrants it and make tapping a cluster yield a predictable closer view or list. Keep filters, result scope, and selection consistent between map and list. Distinguish total matching tasks from currently loaded points and avoid presenting an incomplete cluster count as a market-wide total.

## Implications for the premium UI/UX plan

These are design proposals inferred from the verified sources, not new research findings or newly approved business features:

1. **Protect the existing identity through a coherent system.** Keep the recognizable palette, tone, and character, then express them with semantic roles, measured contrast, readable status labels, and consistent component states. S38–S39 enable organization; they do not select the aesthetic.
2. **Make commitments understandable.** A task, an offer, and an accepted agreement need distinct meaning. The comparison, review, and confirmation surfaces should expose scope, amount basis, time, participants, and actual status. S32 and S36–S37 support relevant patterns without imposing a competitor's economics.
3. **Design the operational states with the same care as the ideal screen.** Permission refusal, partial upload, offline reading, pending delivery, stale data, conflicting changes, and failure recovery belong in the prototype. S27–S30 and S49 support this work.
4. **Make motion responsive and optional.** Specify interruption, rapid repeated inputs, real completion, and reduced-motion alternatives. Use native/host UI for essential controls and optional animation tooling only after exact runtime verification. S26 and S40–S42 do not prove that adding more animation improves a marketplace.
5. **Validate access and physical-device quality.** Check touch areas, drag alternatives, whole-code paste, screen-reader focus, critical non-text contrast, and rendering performance. S44–S48 define relevant constraints but do not certify the complete native app.
6. **Keep location truth and privacy explicit.** Define public versus participant-only information, result scope, and map/list behavior. S34–S35 and S50 do not decide USKOČI's disclosure policy or require a map provider.

## Recommended edits to the source document's wording

- S33: specify that June 2026 is a component CSS maintenance entry, rather than implying a new UX research update.
- S35: state the normal street-address rule and acknowledge the Airbnb-friendly building-name/address exception if giving a comprehensive description.
- S44: identify the proposed list alternative as an application-level design recommendation, not an explicit obligation in 2.5.8.
- S45: preserve the criterion's existing-user authentication scope and its AA exceptions; do not describe one commercial authentication method as mandated.
- S47: prefer “single-pointer alternative without dragging” to “one-finger alternative,” since the criterion also covers mouse and stylus input.
- S40–S41: retain the distinction between an editor capability, the exact web runtime, and unverified native runtime support. A library selection is a separate technical decision.

No source in this audit supplies evidence for replacing USKOČI's identity or claiming a quantified improvement in its users' task success. Those questions remain for a realistic prototype and local user testing.
