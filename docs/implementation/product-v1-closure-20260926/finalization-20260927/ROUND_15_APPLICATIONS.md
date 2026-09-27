# Round 15 — applications handoff and offer review

Date: 2026-09-27. Scope: client source for Moje prijave and the A11/A12 candidate review/selection flow. This is a focused improvement, not whole-P2 or release acceptance.

An application opened from a notification or task detail now appears even when this already-mounted screen kept a filter that excluded it. The route consumes the new application parameter after the current read, reveals the exact owned row, and opens its changed-task review when applicable. It consumes that destination once, so later tab choices and closing the review remain the user's decisions. Missing rows retain the existing honest refresh state.

Candidate review now retires its offer, public-profile and confirmation sheets when the app becomes inactive/backgrounded. Returning performs a fresh owned read before showing selection actions; a delayed read from the previous visit cannot supply the current list. Comparison mode and sorting survive this return for the same task/account. An account change resets these choices.

An already dispatched selection remains the same pending command across return, including its immutable request ID, offer version/hash and reviewed task revision. The in-flight action now says `Povezivanje…`; the earlier uncertainty branch obscured that status with a disabled outcome-check action. Unknown outcomes still require a read before retrying the same command. No selection, viewed-state write or replay is triggered by background/foreground itself.

Changed files:

- `src/app/(app)/moje-prijave.tsx`
- `src/app/(app)/potrebe/[id]/kandidati.tsx`
- `src/ui/v2/ApplicationSelectionPresentation.tsx`
- `src/data/__tests__/my-applications-native.test.tsx`
- `src/data/__tests__/application-selection-native.test.tsx`

Validation:

- Before the fix, two new application-destination regressions failed, and three candidate foreground/selection regressions failed. These were observed failures, not inferred ones.
- First full targeted run: `my-applications-native.test.tsx` and `application-selection-native.test.tsx` — 2 suites / 104 tests passed.
- Added one further delayed-read regression, then reran `application-selection-native.test.tsx`, `candidate-face.test.tsx`, and `list-rows-memoized.test.tsx` — 3 suites / 90 tests passed.
- Final coverage is **4 distinct suites / 141 distinct tests passed**, counting the latest candidate suite once. `git diff --check` passed for the five edited source/test files.
- TypeScript, consolidated integration tests, APK build/install and emulator/phone acceptance are left to the integrator's exact-source receipt. Test filenames containing `native` run through mocked React Native boundaries; they are not device evidence.

Critical review: these fixes close two observed client continuity gaps. Collection paging/query cost and complete live application→selection→Agreement acceptance remain separate work. No TaskCard, DiscoveryPeek, application/candidate card appearance, shared token, dependency, server, payment, credential, provider or DEV data change belongs to this package. Existing white surfaces, Inter typography and FactArt remain intact.
