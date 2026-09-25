# R13 task decision detail

## User's job

Decide whether the work, place, time and terms suit me, and open the correct next step for my relationship to the task.
For my own task, understand its current state and reach the applications without losing the task's terms.

## Three compositions considered before implementation

| Composition | Strength | Cost |
| --- | --- | --- |
| Photo-led editorial page, large image followed by the decision | Strong when a job has useful photographs | Many legitimate tasks have no photograph. The current photo controller owns asynchronous authorization, empty and error states; an invented cover or placeholder would displace the decision. |
| Open decision page: work and price, a place row, adaptive time/people pair, person, then evidence and detail | Fast comparison, a readable first view and strong hierarchy even without media. Removes the nested hero's double gutters. | Requires a deliberate large-text fallback so the time is never compressed into a narrow tile. |
| Person-led invitation: large profile identity, then the job and terms | Human and trustworthy for repeat collaboration | Makes the stranger scan past a person before learning what work is needed. |

Selected: the open decision page. A task reads as one continuous white page, with the money as a separate typographic
anchor and color supplied by fact illustrations. Place is always full width. Time and people sit alongside each other
only when the viewport and system text size allow it; otherwise they become full-width reading rows. The public
publisher is a 56 dp portrait with the existing rating facts. Requirements are illustrated groups with all supplied
values, not a stack of small neutral chips. Owner applications become the one bounded navigation panel near the task
state, while the existing footer remains the only filled primary action.

Photos remain real authorized media through the existing controller, after the decision brief and before longer
requirements and description. No placeholder photography, generated metadata or extra request is introduced. The
photos component's empty/error/owner affordances remain owned by that component.

## Blueprint alignment

- Preserves the task decision, approximate geography, exact terms, requirements, description, media, questions and
  publisher, plus the persistent relationship-aware footer and safety entry.
- The publisher appears alongside the decision facts rather than at the very end: trust is useful before applying.
  The portrait is enlarged from 32 to 56 dp. This follows the owner's later explicit request for a stronger person.
- Price precedes logistics, as the existing tested decision flow already does. Missing price is ordinary ink text,
  never the amount style; per-person amounts retain the existing full-task total note.
- Keeps measured title handoff to the navigation bar. The outer screen transition, existing press response and
  sheets supply motion; numeric facts and labels do not animate independently.

## Boundaries

Presentation-only. No route/data prop changes, dependencies, calls, server, payments, migrations, fake records,
permission requests or device operations. Owner lifecycle recovery stays visible on loading and unavailable reads.
Busy, ownership, applied, unknown relationship, deadline and closed-place conditions retain their current callbacks.

## Implementation and scoped verification

Implemented in `PublicNeedPresentation.tsx`, `NeedPresentation.tsx` and the detail-only
`detail/TaskDecision.tsx`. The publisher portrait is 56 dp. Titles use ink and amounts use the existing green money
token. The time/people band pairs only at widths of at least 380 dp and font scale at most 1.3; all other cases use
full-width rows. These are layout choices, not native acceptance results.

`npx jest -w 1 --testTimeout=30000 --runTestsByPath src/data/__tests__/task-detail-round3.test.tsx
src/data/__tests__/pkg011-slice3-presentation.test.tsx src/data/__tests__/pkg011-slice4-presentation.test.tsx
src/data/__tests__/pkg004-lifecycle-wiring.test.ts` passed: **4 suites / 47 tests**, exit 0, 14.778 s.
The initial run passed 45/47; two previous composition expectations still required photos after the description and
a 48 dp profile target. They now assert the chosen reading order and 56 dp portrait target. Behavior assertions were
retained: amount/offer/missing-price truth, totals, title measurement and reduced motion, all relationship footers,
deadline closure, safety/profile callbacks, selectable-versus-total counts and lifecycle recovery.

No full suite, type check, APK or device review was run by this bounded task. The lead performs the combined checks
and source-bound emulator pass. No native, physical-phone or real-user journey acceptance is implied.
