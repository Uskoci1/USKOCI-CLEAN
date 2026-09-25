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

## Product boundaries

No server, DEV, Edge, payment, migration, dependency or provider/prompt change. No real AI call or microphone
capture. Existing send guards, review/acceptance, draft ownership, privacy, manual editing and activation remain.
Voice mode still shows text replies. This is not full voice conversation or whole-app/store acceptance.

## Validation

Focused source checks passed before the combined gate. The first focused command accidentally named a nonexistent
test file; its four actual suites passed, but that command correctly returned failure. It is not reported as a
passing command. The corrected targeted run passed. Combined validation: TypeScript clean; 309 Jest suites /
6,014 tests passed in 98.475 seconds; migration integrity passed with the frozen 147 files. The existing Jest
worker-teardown warning remains. The independent, bounded integration review found no concrete regressions.
Source/attestation and native evidence are recorded in RECEIPT.json when complete.

Native review is pending the combined APK. No phone or full end-to-end acceptance is claimed.

## Next bounded work

Accept the keyboard, recovery, worker review and large-text layouts on the exact APK; retain real provider and
microphone checks for an owner-ready session. Continue the shared screen/flow plan with offer/selection and
Agreement/messages, and the recorded narrow map/navigation issues. Do not reopen completed backend audits.
