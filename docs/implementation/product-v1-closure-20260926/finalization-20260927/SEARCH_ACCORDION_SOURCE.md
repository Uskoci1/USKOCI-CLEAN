# Search accordion — approved source implementation

2026-09-27. **SOURCE PREPARED / NOT TESTED / NOT BUILT / NOT NATIVE-ACCEPTED.** The owner approved P1_SEARCH and supplied `1-13321.jpg`: separate white floating groups over a soft/blurred background, with the selected group expanded and the others summarized. The owner subsequently approved `expo-blur@57.0.3`; that dependency installation and the underlying Discovery target wrapper belong to the integrator's separate files.

This subtask owns only `src/ui/v2/discovery/DiscoverySearchPanel.tsx` and this report. TaskCard, Peek, filter algorithms, server readers and shared primitives were not edited.

## Implemented source

`DiscoverySearchPanel.tsx:44` adds one local `SearchGroup` presentation component. The existing five sections remain Gde, Kada, Kako se radi, Koliko vas dolazi and Cena; Kako retains its existing conditional availability. One `activeStep` controls them (`:197`), so at most one editor is mounted. Tapping the active header can close it; tapping another opens it and closes the previous editor. The entry's `start` selects its group, with Gde fallback if Kako is unavailable.

Closed headers summarize current draft facts using the existing `whereWords`, `whenWords`, WHERE/PRICE words and person plural. They do not invent history, suggested destinations, a count or a location. The 28/32px colored FactArt, Inter typography, shared turning caret, white surface, card radius and restrained floating shadow reuse current system components/tokens. Section labels stay at body size; there are no tourism tabs or new search categories.

All filter choices remain in the parent's draft. Switching/closing groups does not apply or reset those values. Existing place/query/area/pin normalization, text limit, suggestion derivation, remote behavior, date-range selection, person bounds, price choices, reset and apply/cancel ordering remain in place. The date editor is subordinate to Kada and uses the unchanged DateRangeGrid. Closing/unmounting that editor can remount its display month from the chosen date, as its existing component contract does; the selected dates and in-progress range start remain parent-owned.

Readiness rules at `:292` remain exact: loading/error disable Apply and state their uncertainty; pending permits applying without a number; only ready data yields a count. Place counts and the undated note remain conditional on known data. No client/server counting authority changed.

## Motion, input and accessibility

Group layout uses a restrained 180ms Reanimated LinearTransition and editor entry uses a 160ms container FadeIn. Individual counts, dates and choice labels do not animate. Reduced motion disables these animations and the existing modal fade; the shared TurningCaret follows the root reduced-motion preference. A screen reader also disables group layout/entry motion and never receives programmatic reveal scrolling.

Deliberate group/date expansion records a generation-bound reveal intent. An animation completion callback may scroll only for that same current intent, after a frame reads the latest group/body/calendar layout (`:240`). Reduced-motion layout uses the same fenced completion path. Scrolling itself is immediate, avoiding a competing scroll animation. Another toggle, manual scroll drag, reset, hidden-Kako fallback, close or unmount retires old intents. Typing and count changes do not create reveal intents.

Independent source review identified a stale-layout gap: an old measurement callback could overwrite coordinates before a current reveal frame used them. Group/body/calendar writes and completion callbacks now require the current disclosure/layout owner (`:232`, `:255`, `:299`, `:301`, `:353`); the frame also checks that owner. Its lifetime follows the active group, nested calendar, conditional group availability and width/text-size layout, so unrelated count/text rerenders do not retire a valid reveal. This correction is source-reviewed only; queued native callback behavior remains part of deferred device verification.

Every group header is a button with its full draft summary in `accessibilityValue` and current expanded state. Closed summary text allows two/three visual lines while its full accessible value remains available. The existing radio groups, choice labels, min touch sizes, date hints, polite count region and modal accessibility boundary remain. The screen-reader preference query now cannot overwrite a newer preference event with an older answer.

KeyboardAvoidingView and safe-area edges remain. The footer and person stepper keep their existing narrow/large-text stacking thresholds; the editor and all groups remain in a ScrollView. Native keyboard geometry, screen-reader focus order and large-font appearance have not been observed for this source.

## One approved blur backdrop

The panel accepts `blurTarget?: RefObject<View | null>` and renders exactly one absolute-fill, noninteractive backdrop behind groups/chrome/footer (`:305-310`). It uses the installed package's actual `BlurView` API with fixed intensity 35, light tint and `dimezisBlurViewSdk31Plus`. Blur intensity is never animated.

Android blur is enabled only for API 31+ with the explicit target prop. Older Android or absent target uses the existing neutral `sys.color.veil`. The Modal now sets `hardwareAccelerated`, following independent source review: the installed React Native Modal defaults this flag to false and sets the native window acceleration flag only when requested. The integrator's existing map uses a TextureView, which the tagged Dimezis 3.1.0 implementation supports on API 31+; its source documents Dialog/background targeting. These are source compatibility facts, not a successful native visual check.

iOS starts with an opaque surface until Reduce Transparency is known. `isReduceTransparencyEnabled`, change events and foreground refresh update the preference with stale-query and unmount guards (`:98`). When enabled or unknown, the backdrop stays opaque. Web and non-native environments retain the neutral fallback. The source does not claim parity of perceived blur between platforms.

Local source references used: `node_modules/expo-blur/build/BlurView.types.d.ts`, `src/BlurView.tsx`, `src/BlurTargetView.android.tsx`; React Native `AccessibilityInfo.d.ts` and `ReactModalHostView.kt:103,333-334`; Reanimated `BaseAnimationBuilder.ts` for callback signature. P1 independently checked the tagged Dimezis 3.1.0 [README](https://raw.githubusercontent.com/Dimezis/BlurView/version-3.1.0/README.md) and native controller implementation for Dialog/TextureView support.

## Review limits and deferred verification

Only file/diff/source review occurred here. No tests, type checks, bundle/prebuild, emulator, physical phone, screenshot capture or provider call ran. The installed blur package's compile/autolink/native rendering is unverified. User-approved design structure and source compatibility do not establish visual acceptance.

Independent bounded source review covered draft/apply/cancel, date choices, conditional Kako, keyboard containers, accessibility labels/preference guards, the package diff and native target wiring. Apart from the corrected geometry ownership finding above, that review reported no actionable defect in its bounded scope. This is not native or whole-app acceptance.

When the owner authorizes checks, update the old always-visible filter-overview fixtures for the accordion, then verify: one active editor and draft retention across every switch; ready/loading/error/pending counts; remote normalization and conditional Kako; partial and complete date ranges; person bounds and reset/apply/Back semantics; rapid A→B→A expansion, drag cancellation and retired layout callbacks; 320dp and large text; keyboard above the footer; screen-reader and reduced-motion changes; iOS Reduce Transparency; Android hardware-accelerated blur with the real texture map, older-Android fallback and repeated modal opens.
