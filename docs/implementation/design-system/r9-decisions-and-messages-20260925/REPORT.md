# R9 — task decisions, Agreement recovery and human messages

Date: 2026-09-25. Source `ad0b16ca2a2bc6404b33ca56492e5b2da186e537`, tree
`55fb20389d4c5ab7c54c96fb38187cbc2da3fe5b`, branch `work/uskoci-ui-unification-20260924`.
This is one client batch, not a whole-app or release acceptance claim.

## Purpose and composition

| Surface | The user's job | Alternatives considered | Selected composition |
| --- | --- | --- | --- |
| Task detail | Decide whether the work and its terms fit, then apply. | Photo-led hero is attractive but inconsistent without photos and delays terms; a tiled facts dashboard fragments reading at large text; an open decision brief keeps the essentials together. | Title and truthful price/offer words first; one full-width place/time/capacity band; publisher before longer reading. Description, requirements, existing photos, approximate map and questions remain below. |
| Agreement | Understand the next step and complete or recover the action safely. | A transient toast is easy to miss; an error at the scroll bottom is separated from the fixed command; a persistent action-area notice keeps cause and recovery together. | The existing state-dependent command stays fixed, with its pending state or recovery reason and refresh next to it. Recovery content can scroll when text is large. |
| Human messages | Read the other person and write a reply without the controls crowding the draft. | A single input/control row narrows multiline writing; a full-screen editor loses conversational context; a full-width field above a compact toolbar preserves both. | Nuanced white incoming messages, forest-green outgoing messages, mint ground and one lifted composer with separate 48 dp photo/send controls. |

White is deliberate, not an inherited blank page: restrained shadow separates the decision brief and composer,
tonal green distinguishes logistics and writing controls, and stronger color identifies the speaker. No new
decorative asset or runtime dependency is needed. Existing normal press/sheet/transition motion is retained;
the individual's Reduce Motion preference remains respected.

## Source changes and preserved behavior

- `PublicNeedPresentation.tsx` uses the existing `productPriceParts` contract. TOTAL and PER_PERSON keep their
  basis and coverage wording; offers and missing prices are ordinary words, never styled as an amount.
  The title stays a direct child of the measured hero, preserving its handoff into the navigation bar.
  Approximate location, profile, safety, relation, deadline and apply guards are unchanged.
- `AgreementWorkspace.tsx` puts the existing recovery notice and refresh in the footer. Its main action remains
  disabled when the caller says so. Disabled rows remain legible. iOS announces changed next-step titles;
  Android uses persistent live text. Recovery announces once per episode without a second live-region source.
- `dogovor/[id].tsx` adds display-only ownership of the completion spinner. A different in-flight command must
  not imply completion is running. Focus loss invalidates that display token. Existing write admission,
  serialization, account/focus checks, timeout and server readback still own the command and its outcome.
- `AgreementChat.tsx` changes composition and colors only. Outbox state, retry identity, media, reporting,
  contact consent, terminal restrictions and truthful sent/unknown/failed labels remain intact.
- `AiConversationShell.tsx` also synchronizes reading position at momentum/end-drag. R8's animated return could
  reach the final answer while leaving the latest-message shortcut visible because its last scroll event was
  throttled. The new source handles the terminal event; final APK observation is tracked separately.
- The internal Agreement gallery adds an inert unknown-outcome scene. It uses the real presentation and no-op
  commands, writes nothing to DEV and is unavailable in store builds. An allowlisted `scene` query opens that
  fixture at full route height, without gallery controls, and its chat uses the real route's keyboard avoidance.
  Gallery evidence is not a completed job.

R6 findings 87 and 146 are corrected in source. Native recovery layout and actual screen-reader delivery are
different evidence levels; only observed cases may be accepted.

## Validation

For this exact source, `npx tsc --noEmit -p tsconfig.json` exits 0 and
`npx jest -w 3 --testTimeout=30000` passes **310 suites / 6,031 tests** in **105.906 seconds**, exit 0.
The pre-existing worker teardown warning remains; leak-free teardown is not claimed. `git diff --check` passes.
The focused checks exercise truthful price/basis variants, guarded command recovery, distinct loading ownership,
announcement deduplication/StrictMode, chat interaction and scroll-end synchronization.

Correction emulator APK run: [36110012089](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36110012089).
Build, attestation, installation and bounded native results belong in `RECEIPT.json`. A screenshot of the previous
task-detail composition was captured from the same existing DEV task before installation for direct comparison.
No task, account or fixture was inserted into DEV.

## Native finding and correction

The initial R9 APK `36107782918` was attested and installed with existing emulator data preserved. The same existing
public task was read before/after: the decision brief, sticky-title handoff, approximate map and fixed application
entry were observed at normal size and 320 dp/font scale 2. This task requests offers; other price modes have automated
coverage, not native acceptance in this pass. In the AI gallery, the latest-message shortcut now disappears after
its animated return. These are bounded observations, not a real provider or two-party job.

Native observation found a defect missed by renderer tests: the footer's recovery ScrollView collapsed to about
45 dp, clipping Refresh. The correction measures a message-only scrolling region and keeps Refresh plus the guarded
primary outside it. Its viewport is limited to a quarter of screen height (at most 180 dp), while command labels
retain their natural height. The shared footer no longer has the 50% cap that could clip the controls. Measurement
resets when text, width or text scale changes. The new regression checks callbacks, measured short/long content,
short viewport, font changes, retained guards and unchanged announcement count.

The initial gallery also lacked the real chat route's KeyboardAvoidingView. Its initial covered-composer capture
is not evidence of product-route behavior. The corrected inert fixture uses the same wrapper and supports a known
direct scene, so the gallery header/picker no longer consume the product's reading space during acceptance.
The correction's exact source, automated checks and native results are recorded in the receipt.

## Boundaries and next work

No server, migration, DEV data, Edge, provider prompt, payment, key or dependency change. No paid provider call,
microphone capture or real completion command. Dictation and spoken AI answers are not accepted by visual tests.

The next coherent client batch is the Home appointment composition plus known narrow/large-text map, search,
navigation and attribution issues. Real offer-to-selection-to-completion, reconnect/history, phone and screen-reader
acceptance remain separate. Existing chat backend/read-model findings are not closed by a visual redesign.

## Correction APK observation

Run `36110012089` passed both byte attestations and was installed with `adb install -r`. On the exact correction
APK, the recovery message, Refresh and guarded primary command are visible at normal size and 320 dp/font 2.
The AI return shortcut disappears after reaching the latest answer. The closed-message scene exposes no composer.
These are inert gallery observations; no real Agreement command was executed. The previous task-detail captures
belong to the initial R9 source and are not relabelled as captures of this APK.

The direct chat gallery still contained one extra View above the KeyboardAvoidingView. Native keyboard observation
revealed its origin differed from the real route by the safe-area inset. R10 removes this fixture-only wrapper and
must re-check keyboard fit. This is not treated as a measured production-route failure or a completed keyboard pass.
An existing person-role subtitle truncates at font 2; phone and screen-reader acceptance remain open.

## Follow-up recorded after R10

Home agenda, responsive map/navigation and the filter action correction are implemented and have bounded R10 emulator evidence. The R9 latest-message correction was observed; R10 also observed normal docked human-chat keyboard controls after matching the fixture origin. Extreme-text keyboard/history composition remains open. Original emulator density/font and Gboard stylus-writing ON were restored. See the R10 receipt for its exact build and limits; these earlier captures are not relabelled.
