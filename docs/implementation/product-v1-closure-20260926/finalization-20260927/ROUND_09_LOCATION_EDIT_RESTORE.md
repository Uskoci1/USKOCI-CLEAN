# Round 09 — discard restores the confirmed location point

Status: SOURCE PREPARED; tests/types/build/native execution NOT RUN.

`NeedLocationForm` previously removed a confirmed point as soon as its editor reported an unconfirmed change. “Odbaci nepotvrđenu tačku” reset the editor but had no retained point to restore. Opening an existing task location, moving its pin and discarding therefore lost the previously confirmed point from the local form.

The form now keeps `points` as the latest explicitly confirmed values. A pending edit stays inside `LocationPointEditor`; the existing pending guard blocks form submission and point switching. Discard remounts the editor with the retained point, including its private address/notes. Explicit confirmation replaces that slot's baseline. The pending slot is shown as awaiting confirmation and excluded from the displayed confirmed count.

No separate cache or persisted state was introduced. Existing geography/country/exact-address changes still clear every point, pending state and editor incarnation, so returning to old input cannot restore invalidated coordinates. Parent account/focus ownership, revision-bound editor scope, normalization and save/review contracts are unchanged. No server, provider, dependency, navigation or TaskCard changes.

Focused source regressions in `src/data/__tests__/w02-location-native.test.tsx` cover repeated moves → blocked save → discard → original point/private fields; confirming a replacement → another move/discard → latest confirmation; preservation of the other route point; and city/country A→B→A invalidation while an edit is pending. These regressions have not been executed in this package. No commit or push.
