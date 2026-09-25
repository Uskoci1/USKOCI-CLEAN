# R14 — Agreement presentation refinement

## Decision

The list must help the person recognize a collaborator and open the right accepted job; the overview must distinguish
accepted logistics and price from editable task information. Considered: (1) a flat message-style inbox, which conceals
important accepted terms; (2) date-grouped agenda rows, which underplay unknown-time work and require new grouping;
(3) person-led agreement cards with separate logistics, total and existing attention action. Selected the third: it
makes the person and the accepted terms easier to scan without creating statuses or changing the collection's order.

## Implemented

- List portraits use 56 dp, with the same photograph/initials/missing-person fallback. Names and roles may use two
  lines. The state belongs to this identity group, keeping it distinct from the task title.
- More deliberate whitespace separates identity, task, accepted time/place/people and the amount. The amount has
  its own line and still explicitly says `ukupno`; a missing amount remains muted words. Icons are 20 dp, text sizes
  are unchanged. One body press and the independent rating action retain their exact callbacks and target boundaries.
- The selected confirmation filter stays white, using its check and border to communicate selection.
- The overview labels accepted terms, retains the exact version/timezone/remote/people facts and separates the total
  with a neutral rule. The compact conversation shortcut remains the same action on white with a subtle divider.
- Existing card press and list-entry motion, reduced-motion handling, sorting, active/history membership, attention
  precedence, loading/error/empty views, refresh, calendar and role interpretation are unchanged.

R11's native review warned about constrained conversation space. This change does not enlarge the 40 dp chat header
portrait or the summary's minimum height. The route-owned `NextStepCard`, footer commands, permissions and recovery
remain outside this bounded presentation scope. No fabricated arrival/progress, ratings or message previews.

## Checks and limits

Passed focused Jest: **6 suites / 50 tests**, 20.472 seconds:

`npx jest src/data/__tests__/agreement-collection-presentation.test.tsx src/data/__tests__/agreement-collection-screen.test.tsx src/data/__tests__/agreement-thread-presentation.test.tsx src/data/__tests__/list-rows-memoized.test.tsx src/data/__tests__/pkg005-calendar-navigation.test.tsx src/data/__tests__/pkg011-slice1-presentation.test.tsx -w 1 --testTimeout=30000`

The existing missing-person test now expects the 56 dp collection fallback; its 40 dp header and 56 dp people-row
expectations remain unchanged. Other tests continue to cover real terms, private-data omission, both account roles,
rating navigation, attention priority, history, empty/retry paths, calendar, memoized rows and conversation context.
`git diff --check` passed for the three changed source/test files (usual LF-to-CRLF warnings only).

Combined types/full Jest, APK and native visual review belong to the integrator. Inspect ordinary-text card rhythm,
long identity/term wrapping, the overview's first viewport and the compact keyboard conversation. No phone, iOS,
screen-reader or complete business-flow acceptance is claimed here. No route, server, dependency or provider changed.
