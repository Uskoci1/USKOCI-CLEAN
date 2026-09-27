# Round 21 — finish map selection, questions, availability and privacy

2026-09-27. **CLIENT SOURCE + FOCUSED CHECKS PASS; NEW NATIVE ACCEPTANCE PENDING.**

## Problem and product decision

An explicit map selection must work again after a person pans; it must not be confused with an ordinary data refresh. Back must immediately retire a question screen before slow journal persistence can dispatch an abandoned submission. Availability confirmations must apply only to the exact schedule they displayed. Privacy controls must become usable when the route receives focus, even if resource reads have already settled.

## Implementation and UX

- Map preview sends a fresh camera intent for each selected point or Show all action. Unchanged background data preserves the user's camera. The initial all-points view no longer highlights the first row as if that point were selected; navigation may still use that first point as its explicit label/fallback.
- Task questions bind actions to the current rendered visit. Back retires pending callbacks immediately, leaves the command journal available for read-first recovery, and remains available on the invalid-task error screen.
- The worker AI availability panel locks during its editor read. Rule/copy/delete confirmations and sheet callbacks retire on changed schedule, draft, editor or loading state; normal editing remains available. No AI request or server contract changed.
- Privacy gives each focus visit render-owned state. Fresh controls now work without depending on an unrelated fetch to trigger a render. Prior-visit callbacks, account fences and one-shot navigation remain.

No TaskCard/DiscoveryPeek redesign, dependency, payment, DEV, Edge or certificate change. Files and exact byte hashes are in ROUND_21_CLIENT_CHECKS.json. Existing RPCs and recovery contracts are unchanged.

## Verification and regression

Integrated TypeScript passed. Eight distinct targeted suites / 199 tests passed across the four changes; regressions were reproduced before their corresponding fixes. The full Jest suite was not repeated.

Round20 APK run36337043414 at d1091eab was installed without resetting the session; downloaded and installed hashes match. Native map fit/point selection/Back worked. The repeated-camera-selection defect and unresponsive Privacy entry were observed in this exact prior build. See ROUND_21_NATIVE_BEFORE.json. This is before-fix evidence, not acceptance of the new source. No account closure request, provider push, paid AI or live business mutation was made.

## Next

Build one consolidated APK; check repeated map selection and Privacy entry/dismissal/return. Continue My Tasks and exact-message notification work independently. P0 application and disposable B3c certificate approval remain pending; P4 is a separate unapplied candidate.
