# R13 — Home as a clear starting point

User job: choose what to start, notice what needs an answer, and open the next real Agreement without changing roles.

## Functional evidence

Read `HomePresentation.tsx`, `homeSnapshot.ts`, the Home route tests, the inert gallery tests and the UX blueprint.
The same account can publish and apply. Both start actions must work before reads finish. Server attention is a
separate read: its exact reasons, subjects and `more` total cannot be reconstructed from the other lists. Ratings
have their own count and destination. The next Agreement has separate display facts for time, role and counterpart;
none may be parsed from a sentence or inferred from a date. Unavailable reads cannot look empty.

The current R12 capture has a large orange launch tile, a similar white tile, a rounded attention box and a rounded
appointment. They are understandable, but nearly every group competes through a surrounding rectangle. A palette
change alone does not distinguish their jobs.

## Compositions considered

| Composition | Strength | Cost | Decision |
| --- | --- | --- | --- |
| Large full-width publish hero, earning as a secondary row | Strong single focal point; room for artwork | Makes earning feel secondary even though one account has two equally valid intentions; delays attention | Reject |
| Attention-first agenda, with two compact launch buttons beneath | Excellent for a returning user with an immediate obligation | The top of the screen moves after asynchronous reads; new users receive a different starting structure; the two key actions lose reach | Reject |
| Two illustrated white launch doors, an open attention inbox, one elevated appointment | Keeps a stable first action area, gives each content type its own anatomy and uses color in meaningful objects | Requires original launch artwork and native validation at enlarged text | Select |

## Implemented composition

- The two starts share one open white area. Original task-sheet and local-map artwork sits directly on white,
  at 76 dp in the standard composition; the labels are 20/25 and the helper is 14/20. A quiet vertical divider
  separates intentions without making two more cards. Narrow/large-text layouts use 52 dp artwork and flexible rows.
- Attention becomes a flat inbox: 32 dp FactArt, the complete action and reason, quiet separators and a clear
  directional affordance. The total remains the server count, beside the heading rather than inside a pill.
- The next Agreement is the only elevated content object. Its exact time and role lead; a green rule groups the
  work title and counterpart below. No invented progress track, profile photograph, rating or status is added.
- A due rating stays under attention, with the star and action words carrying the accent on white. Its single-versus-
  multiple routing and Serbian plural forms are untouched.
- Personal lists remain readable open rows with their own true counts. Loading, first-run illustration, unavailable
  sections and retry retain their existing conditions and callbacks.
- Existing `Press` spring/haptic response and new-row `Appear` handling remain. Static illustration and stable facts
  do not loop, bounce, or re-enter on each refresh. No new animation dependency is introduced.

## Blueprint alignment and intentional difference

The screen still matches the blueprint's two starts, attention, next Agreement and ownership entries. No functional
disagreement is introduced. The owner explicitly freed composition and rejected mint surfaces: the historic orange
full-tile rule becomes a small orange publish illustration, so the whole first view reads as white, lighter and more
balanced between the two roles. The action names and destinations remain equally prominent.

## Checks and limits

`npx jest src/data/__tests__/v3-home-screen.test.tsx src/data/__tests__/dizajn-pocetna.test.tsx -w 1 --testTimeout=30000`
passed: 2 suites, 49 tests. Only the old solid-orange/pale-rating-surface assertions changed; routing, ownership,
partial reads, counts, large-text ancestry and all existing behavior assertions remain intact.

Full types/Jest and exact APK/native inspection are owned by the R13 integrator. These tests do not prove native
line wrapping, spring quality, phone acceptance or a live business journey. No data service, server, provider,
payment, global token, route or gallery changed in this Home task.
