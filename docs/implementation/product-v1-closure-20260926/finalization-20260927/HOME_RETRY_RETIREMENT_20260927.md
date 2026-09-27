# Home retry retirement — 2026-09-27

One client-only lifecycle defect reproduced and fixed. Source reviewed at
`cb63b847cd39980f0b67fd437d07c3e4d8e78328`; no device/build or server claim.

Before: a person starts “Osveži pregled” while Home has an unavailable section.
One section hangs. The app backgrounds, so `useFocusedResource` aborts that read,
then starts a fresh one on foreground. If the new read fails quickly, Home shows
an enabled recovery action, but its route still holds the abandoned retry's latch.
The tap is silently ignored until the old section settles or reaches its 15s deadline.

Red reproduction in `v3-home-screen.test.tsx`: after initial read, abandoned retry
and failed foreground read, tapping the enabled action should start read 4. All
source mocks remained at 3 calls. Targeted run: 1 failed / 42 skipped.

After: `src/app/(app)/index.tsx` accepts the existing resource AbortSignal and binds
the retry latch to that exact read. Abort immediately retires its retry owner. Identity
comparison prevents either the old abort or its late completion from unlocking a
newer retry. The listener is removed when the section read settles.

The regression also resolves the abandoned result while the new retry is pending
and repeats its retained callback: no fifth read starts and the current loading
state remains. Account/focus/navigation guards, section deadlines, unknown-vs-empty
semantics and all four source calls remain unchanged. This does not add network
cancellation to adapters that do not accept signals.

Validation:

- First full run: 42 passed, 1 new assertion failed because all-failed recovery
  correctly shows initial loading instead of a retained-snapshot refresh button.
  The new expectation was corrected to the existing presentation state.
- Final focused Home suite: **43/43 PASS**, 14.646s.
- Scoped `git diff --check`: PASS.
- No shared hook/helper, TaskCard/Peek, server, dependency, payment or control edits;
  no build, commit or device execution. Root owns integration TypeScript/native checks.
