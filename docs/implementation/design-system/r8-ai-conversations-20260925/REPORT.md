# R8 — task and worker AI conversation experience

Date: 2026-09-25. Branch: `work/uskoci-ui-unification-20260924`.
Owner priority: finish coherent UI/UX batches, with fluid normal motion and fewer repeated builds.
The root master design plan remains the design plan; the control table remains the execution tracker.

## Delivered source scope

- Shared conversation: full-width multiline composer, separate attachment/speech/send toolbar, focused border,
  clearer USKOČI identity, readable bubbles, opening choices and honest typing state.
- Adaptive pinned summary: compact with keyboard, pending turn, short display or increased text size. Task facts
  and worker skills are still server-owned. One press opens the existing review.
- Reading continuity: a latest-message shortcut while reading earlier content; new content does not force the
  reader down. Existing history and stream-to-record replacement do not replay entrance animation. Completed
  assistant messages announce once by ID. Task identity remains stable through first-send server ID assignment.
- Worker welcome avoids an empty profile card. Worker review groups all frozen facts into open, illustrated
  sections, preserving licences, missing fields, paused schedules, dates and time zone.
- Local DEV gallery includes the empty worker interview. Its controller is inert; fixtures never reach DEV.
- Owner refinement: mint canvas, nuanced white reading/writing surfaces, high-contrast forest user bubbles,
  illustrated opening actions, stronger summary hierarchy and restrained elevation. No new library or asset.
- The initial APK exposed a crowded 320 dp / font scale 2 composition. At very large text or very short heights,
  the existing summary now scrolls with the conversation; it is not removed and remains the same review target.
  Normal keyboard layout keeps the compact summary. Viewport changes retain the latest answer only when the
  person was already following the end of the thread.

## Product boundaries

No server, DEV, Edge, payment, migration, dependency or provider/prompt change. No real AI call or microphone
capture. Existing send guards, review/acceptance, draft ownership, privacy, manual editing and activation remain.
Voice mode still shows text replies. This is not full voice conversation or whole-app/store acceptance.

## Validation

Focused source checks passed before the combined gate. The first focused command accidentally named a nonexistent
test file; its four actual suites passed, but that command correctly returned failure. It is not reported as a
passing command. The corrected targeted run passed. Combined validation: TypeScript clean; 309 Jest suites /
6,016 tests passed in 113.606 seconds for the final source; migration integrity passed with the frozen 147 files
before the style-only refinement, with no migration changes afterward. The existing Jest
worker-teardown warning remains. The independent, bounded integration review found no concrete regressions.
Source/attestation and native evidence are recorded in RECEIPT.json when complete.

Initial source `5da4bb6e` / APK run `36103219291` passed both APK attestations and was installed without clearing
data. Its 320 dp / font scale 2 composition motivated the scrollable-summary refinement. Final source is
`0976b373` / tree `89fcf4e43474ed9624bc33022500c46bf65ced72`; final APK run `36105043985` succeeded,
passed both exact-source APK attestations, and was installed with data preserved. Bounded emulator observations
cover both welcomes, task thread, unknown-outcome recovery, worker review and 320 dp / font scale 2.
The summary remains reachable in history and the latest-message shortcut returns to the final answer.
Additional observation: after that animated return the shortcut can remain visible, at normal and large text.
R9 adds terminal-scroll synchronization; its new APK must independently prove that the shortcut disappears.
Normal density/font scale were restored. The focused field compacts its summary; this emulator's floating
Gboard handwriting toolbar does not establish docked-keyboard acceptance. Screens are in `screens/`.
No phone or full end-to-end acceptance is claimed.

Follow-up on the same installed `0976b373` APK: Gboard's enabled "Use stylus to write in text fields" mode
caused the floating toolbar. Temporarily turning that emulator-only setting off through Gboard settings produced
the normal docked QWERTY keyboard. At normal size the final answer, full-width draft and all commands remained
visible; a multiline local gallery draft was typed without Send. At 320 dp/font 2, after dismissing Gboard's own
font-size notice, the field and commands remained above the keyboard. Only the last lines of the long answer
fit the remaining reading region; full-answer scrolling in that composition was not accepted in this pass.
This accepts those bounded emulator keyboard compositions, not a real provider/microphone/phone journey. The
native receipt records screenshots and temporary-setting restoration.

Calculated contrast ratios of the new text/surface pairs: white/user forest 8.94:1, muted/summary 4.53:1,
green/summary 5.20:1, ink/white surface 14.91:1, muted/mint ground 4.87:1. This is color contrast evidence,
not a substitute for physical-device or screen-reader acceptance.

Control table regenerated locally: 62 execution rows, 31 with a recorded problem and 31 awaiting phone acceptance.
These are workflow rows, not a defect total. Upload to the signed-in existing Claude artifact was attempted through
its file input; the browser chooser timed out and the input remained empty. The published page still shows
24 September / `0db57f50`. Local regeneration is not publication.

## Next bounded work

Accept full-answer scrolling with the large docked keyboard and actual screen-reader delivery; retain real provider and microphone checks for
an owner-ready session. R9 continues Agreement/messages and task detail, including the return-shortcut correction.
Then continue Home and the recorded narrow map/navigation issues. Do not reopen completed backend audits.

## Follow-up recorded after R10

Home agenda, responsive map/navigation and the filter action correction are implemented and have bounded R10 emulator evidence. The R9 latest-message correction was observed; R10 also observed normal docked human-chat keyboard controls after matching the fixture origin. Extreme-text keyboard/history composition remains open. Original emulator density/font and Gboard stylus-writing ON were restored. See the R10 receipt for its exact build and limits; these earlier captures are not relabelled.
