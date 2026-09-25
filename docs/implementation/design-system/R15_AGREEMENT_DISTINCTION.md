# R15 — Agreements read as accepted appointments

## Composition choice

1. **Rounded receipt cards:** safe grouping, but repeats the Task advertisement silhouette the owner rejected.
2. **Timeline with milestones:** visually distinct, but arrival/travel milestones are not facts in this projection.
3. **Open person-led appointments — selected:** a recognizable 56 dp person, actual compact status, strong accepted
   schedule and work grouped by a quiet rail, with people/total beneath; hairlines separate appointments.

Selected because an Agreement coordinates accepted work, while a Task card advertises work still available.

## Implementation

`AgreementCollectionPresentation.tsx` removes the rounded enclosing card. Identity leads; the accepted schedule now
precedes the work title, stays complete rather than clamped, and uses bold green without a size increase. A vertical
rule groups accepted terms; it is not a progress indicator. Place stays visible; people and the restrained accepted
total share a wrapping final line. The list retains white surfaces, strong ink and the 56 dp photograph/fallback.
The separate attention/rating target retains its existing sentence, orange dot, arrow and minimum 52 dp height.

`AgreementPresentation.tsx` makes the accepted overview an open appointment record: schedule, moderate 20/26 ink work
title, place and group facts, then the existing 17/22 accepted-total line. It no longer reuses the advertisement's
`ProductTitle`. The existing route-owned next step already precedes this component (R14); its actions and guards are
untouched. Compact chat summary, Back, tabs and disclosures retain their behavior.

No fabricated dates, arrival milestones, unread counts or ratings. All state words, amount absence, full timezone,
remote privacy, grouping/coverage facts, attention priority, rating callback separation, loading/error/empty paths,
memoized sorting, card press/list arrival motion and Reduce Motion are retained. No source outside the two owned
presentation files changed in this pass; no server, provider, dependency, payment, build or device action.

## Verification

Existing focused tests passed: **6 suites / 50 tests**, 20.497 seconds.

`npx jest src/data/__tests__/agreement-collection-presentation.test.tsx src/data/__tests__/agreement-collection-screen.test.tsx src/data/__tests__/agreement-thread-presentation.test.tsx src/data/__tests__/list-rows-memoized.test.tsx src/data/__tests__/pkg005-calendar-navigation.test.tsx src/data/__tests__/pkg011-slice1-presentation.test.tsx -w 1 --testTimeout=30000`

`git diff --check` passed for both source files (usual LF-to-CRLF warnings only). No test expectations were edited.
Combined type/full-suite gates and native review belong to the integrator. Inspect an active/waiting/history list,
ordinary and long accepted schedules, group total wrapping and the overview beneath its real next-step action.
Native visual quality, phone/iOS and screen-reader acceptance are not established by these tests.
