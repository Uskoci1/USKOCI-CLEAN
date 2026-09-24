# Round 6 — unit `objava` (Pregled pre objave, mesto zadatka i fotografije)

Branch `work/uskoci-r6-objava-20260924`, based on `ecb0f13` (`work/uskoci-ui-unification-20260924`). Spec:
`docs/implementation/design-system/r6-specs/objava.spec.json`. No pull request opened.

## Commits

| sha | what |
| --- | --- |
| `ad9ee67` | build: publish review, place step and form, photos, pure helpers, gallery `/dizajn-objava` |
| `e762e82` | review fixes, lenses `tok` (flow) and `izgled` (visual/a11y) |
| `fda1245` | review fixes, lens `zastite` (correctness), and two regression tests |
| (this commit) | this report |

## Verification

- `npx tsc --noEmit -p tsconfig.json`: clean.
- Full `npx jest -w 3 --testTimeout=30000` on `fda1245`: **Test Suites: 299 passed, 299 total / Tests: 5777 passed, 5777 total**. On
  `ad9ee67`: 299 / 5,774. No first-run timeout occurred.
- Line endings: LF only (no CR in any changed file).
- No dependency, server, migration, Edge or key change. The gitignored `entryReferenceData.ts` is not committed.

## Files

Changed (unit): `src/app/(app)/pregled-zadatka.tsx`, `src/app/(app)/mesto-zadatka.tsx`, `src/app/(app)/fotografije-zadatka.tsx`,
`src/ui/location/NeedLocationForm.tsx`, `LocationPointEditor.tsx`, `LocationControls.tsx`, `CountryField.tsx`,
`src/ui/media/AuthorizedPhoto.tsx` (visual only). `src/app/(app)/pregled-nacrta.tsx` is byte-identical, as the spec requires.

New: `src/ui/objava/ReviewPresentation.tsx` (review parts), `src/ui/objava/TaskPhotosPresentation.tsx` (photo parts),
`src/ui/objava/reviewFacts.ts` (`reviewRowValue`, `publicAnchorPoint`, `reviewTodos`, pure),
`src/ui/v2/draftSummary.ts` (`publicSummary`, pure), `src/app/dizajn-objava.tsx` (gallery),
`src/ui/objava/__tests__/reviewFacts.test.ts`.

Tests changed (harness and intent kept): `v5-review-screen` (mocks for the preview map and SuccessMark; a BackHandler
recorder; the check "publish grey while the place is edited" became "no publish drawn in the place step, and a
retained publish does nothing"); `v5-task-photos-screen` (the SettingsScreen mock draws the footer; a ConfirmSheet
recorder); `w02-location-native` (reasons are read from the save's `reason` prop; the busy save is found by its label
with `loading`); `locationPointEditor` (actions are found by their spoken name, because a proposal now shows the bare
address). New tests: the category is never named; a missing place opens the place step; no second way back to the
conversation; the success animation plays only for a publish done here; Android Back leaves the place step, including
after an unconfirmed outcome; time without seconds and money with grouping; photo removal asks first; the unconfirmed
exits appear once each and survive a failed list read; the empty draft; `saveBlockReason` pending point and
gender-free wording; `reviewRowValue`, `publicAnchorPoint` (including half-away-from-zero rounding for negatives) and
`reviewTodos`.

## What the screens are now

- **/pregled-zadatka**, top to bottom:
  - **Status:** what the stored command ended in. It is green with SuccessMark when published, and the animation
    plays only when the publish happened on this screen. Otherwise it is a quiet box.
  - **"Ovako će drugi videti zadatak":** one compact card built from the task card's parts (title, value slot, place,
    time, people), with a quiet "Izmeni naslov". Photos never appear in it (owner decision 10).
  - **"Još treba":** white rows with the orange dot, each leading to its fix. The category is never named.
  - **Mesto:**
    - "Vide svi": the area, a route's stops, and a read-only map of the approximate public point (the server's
      two-decimal anchor).
    - "Privatni podaci": the privacy sentence word for word, and the private rows.
  - **Detalji:** hairline rows; times in the `vreme` format; money through `novac`; no coordinates.
  - **Fotografije:** three-column tiles.
  - **Prijave:** the deadline.
  - **Footer:** one green "Objavi zadatak". Its spinner shows only while publishing. When grey it has one line of
    reason, also spoken as its hint. The quiet "Sačuvaj nacrt" follows.
  - **Loading and error:** loading is a StateView skeleton. A failed first read is a StateView error with "Učitaj
    pregled i proveri ishod".
- **Place step** (the place editor inside the review):
  - It replaces the whole review: title "Mesto zadatka", arrow "Nazad na pregled", and Android Back does the same.
    Only a save in progress holds the step.
  - The form uses `layout="screen"` and scrolls. Its groups are "Vide svi" and "Samo u Dogovoru", with no box inside
    another box.
  - The sticky footer has the green save with loading and its reason, and the only "Odbaci nepotvrđenu tačku".
  - The country and working-mode choices open the shared bottom sheet (ProductSheet), which says "Još nije dostupno"
    for a country not yet available.
- **/mesto-zadatka:**
  - Loading and a failed first read use StateView.
  - An invalid id shows "Mesto nije dostupno" with no retry.
  - After a save: a success row and a white "Nazad na pregled". The form's save stays the one green action.
- **/fotografije-zadatka:**
  - **Status line:** each message has its tone (in progress, success, error, info). The message strings are unchanged.
  - **Grid:** two columns, one per row at large text. Each photo has a corner remove button that asks first
    ("Ukloniti fotografiju?"). There are tiles for processing, failed, sending and unconfirmed photos.
  - **Unconfirmed send:** "Nastavi slanje iste fotografije", "Odustani od nepotvrđenog slanja" and "Osveži i proveri
    fotografije".
  - **Other states:** empty, loading and read-error states.
  - **Footer:** sticky, "Izaberi iz galerije" (green) and "Fotografiši", with one reason line.
  - **Privacy notice:** the limits and the Google Gemini notice, word for word, always above the footer.

## Gallery `uskociapp://dizajn-objava`

It is internal only, like `dizajn-tabla`. It reads and writes nothing: commands are no-ops, the address search answers
"not activated", and photos are stand-ins (only the map's public tiles load). It has a scene list and "Nazad" (and
Android Back) to return to the list.

- **Pregled pre objave:** Spremno za objavu · Još treba · Objavljuje se · Objavljeno · Privatan nacrt · Ishod nije
  potvrđen · Učitavanje · Greška · Veliki tekst (raspored)
- **Mesto zadatka:** Izmena mesta · Od mesta do mesta · Rad na daljinu · Nije dostupno za izmene · Sačuvano (stari put)
  · Učitavanje
- **Fotografije zadatka:** Mreža i stanja · Slanje u toku · Slanje nije potvrđeno · Šest fotografija · Prazno ·
  Učitavanje · Greška čitanja · Pitanje pre uklanjanja

## Deviations from the spec, with reasons

1. **Where the helpers live.** The spec moves `publicSummary` out of `IntakePresentation.tsx` and adds `reviewRowValue`
   to `aiNeedV2Ui.ts` and `publicAnchorPoint` to `lib/location.ts`. The brief forbids editing files outside the unit,
   so these are new files (`draftSummary.ts`, `objava/reviewFacts.ts`). **For the lead:** point `IntakePresentation.tsx`
   at `ui/v2/draftSummary.ts` and delete its private copy. That is one import and no behaviour change.
2. **The review's private group label.** It is "Privatni podaci", not "Samo u Dogovoru". This heading and its privacy
   sentence are pinned by an existing test and by the spec's keep-verbatim rule. The place form uses "Samo u
   Dogovoru". Both sit under the lock icon.
3. **The publish button.** It stays the custom Press, as the spec keeps it; its states are pinned by tests. The
   visual reviewer suggested V2Action; instead the button now speaks its reason as a hint, and the caption is a live
   region.
4. **Point confirmation.** "Potvrdi tačku" is white only in the long form, which passes `confirmAsPrimary={false}`. It
   stays green in the conversation's point sheet (`ConversationPointAsk`), where it is the only action that saves.
5. **The title is editable in place from the preview ("Izmeni naslov").** The removed bottom "Izmeni u razgovoru" had
   been the only visible way to change it.
6. **Photos.**
   - "Osveži i proveri fotografije" is also shown while a photo is still being processed, so there is no dead end.
   - Every tile can be removed again. The spec drew remove only on READY and FAILED tiles, but the old screen allowed
     removal in any state and `remove()` has no state guard.
   - The unconfirmed-send exits stay visible when the list read fails. The spec's read-error state would otherwise
     have hidden the server-owned cancel (PKG-046).
7. **The reason under the grey publish.**
   - A server refusal that no row names now gets its own row: "Zadatku je potrebna dopuna u razgovoru." It leads to
     the conversation.
   - The "tačan termin" note shows only when there is no deadline.
8. **The place step's back arrow** is held only while a save is in progress. The old "Nazad na pregled" was also
   disabled after an unconfirmed outcome, which trapped the person.

## Review issues → outcome

- **`tok` (flow/UX), verdict "fix first":**
  1. The place read failed silently → **fixed** (message next to the button).
  2. A grey publish with no reason → **fixed** (the "other" row).
  3. No way to edit the title → **fixed** ("Izmeni naslov").
  4. "Proveri" had no loading → **fixed**.
  5. The photo reason printed twice → **fixed** (one reason under the last button).
  6. The plural "tačaka" → **fixed** ("Potvrđeno tačaka: X od Y").
  7. Two group names → **skipped**, see deviation 2.
  8. The deadline note on every task → **fixed** (only without a deadline).
  9. "Lokacija" vs "Mesto" → **fixed**.
  10. The two "Nije navedeno" lines open together → **skipped**. It is harmless: one tap shows everything that was
      hidden, which is the purpose.
  11. `mesto-zadatka` did not check its id → **fixed**.
- **`izgled` (visual/a11y), verdict "fix first":**
  1. The point sheet lost its primary → **fixed** (`confirmAsPrimary`).
  2. The unavailable-photo text clipped in small tiles → **fixed** (icon only; the sentence is spoken).
  3. Photo placeholders overflowed at large text → **fixed** (one per row at 1.3 or more; two lines; clipped).
  4. Two green actions after a save on `mesto-zadatka` → **fixed** (white "Nazad na pregled").
  5. The publish reason was not spoken → **fixed partly**, see deviation 3.
  6. Spacing literals → **fixed**.
  7. The input's own look → **fixed** (`field` token).
  8. `expanded` state → **fixed**.
  9. Header role on the groups → **fixed**.
  10. `radiogroup` → **fixed**.
- **`zastite` (correctness), verdict "fix first":**
  1. Place step trap after an uncertain outcome → **fixed**, with a test.
  2. The cancel was hidden after a failed list read → **fixed**, with a test.
  3. A processing photo could not be removed → **fixed**.
  4. Missing regression tests → **added**.
  5. The privacy sentence depended on the anchor point → **fixed**.
  6. Checkbox wording → **left for the owner** (below).
  7. The review-only guidance line → **restored** ("Mesto će biti prikazano u završnom pregledu. Zadatak još nije
     objavljen."). The two explanatory lines stay removed, following the owner's no-explanation rule.
  8. Loading on "Proveri" → **fixed**.
  9. A grey publish with no reason → **fixed**, with a unit test.

## Owner decisions left open

- **Place confirmation checkbox wording.** "Proverio/la sam javno mesto i privatne podatke." is now "Javno mesto i
  privatni podaci su provereni.", the same meaning without gender. It is the confirmation behind `confirmed: true` on
  the legacy `/mesto-zadatka` save. It was treated as a data-correctness confirmation, not legal consent; the owner
  should say whether it is consent text.
- **The small read-only map in the review.** It shows the approximate public point, the same two-decimal point the
  server publishes. If the owner prefers the area text only, drop the map; the helper stays.
- **Location permission.** Unchanged: the place step never asks for location (no "Koristi gde sam" there).
- **Address search for public release.** LocationIQ or the state address register (owner decision 8). The screens keep
  the honest "Pretraga mesta još nije aktivirana" state.
- **The photo processing notice.** Kept word for word, and only moved to the bottom above the sticky add buttons. Any
  shortening is a legal or privacy decision.
- **Retiring `/mesto-zadatka` and `/pregled-nacrta`.** Stays with PKG-023; both still resolve.

## What the emulator check should look at

1. **`dizajn-objava`, every scene, at 320 / 360 / 390 / 430 dp and font scale 1.3:**
   - the preview card's value slot stacks under the title at large text;
   - the section headers wrap next to their quiet actions;
   - the three-tile photo row fits at 320;
   - the photo placeholders go one per row at 1.3;
   - the publish label wraps.
2. **The real review:**
   - "Dodaj mesto" → place step → Back (the arrow and Android Back);
   - "Primeni izmenu mesta" returns to the review with the new place and the approximate-point map (the map height is
     160);
   - "Izmeni naslov" and an inline correction scroll into view above the keyboard (Android `KeyboardAvoidingView` is
     now `height`).
3. **The shared components on other screens:**
   - `profil/lokacija` and WorkerAreaSearch: the country and working-mode choices now open the bottom sheet; the row
     is 56 dp with the turning caret;
   - the conversation's point sheet in `/nova`: "Potvrdi tačku" is still green; proposals are white rows with a pin;
   - AuthorizedPhoto's failure look in the Agreement chat, support and profile photo.
4. **Photos:** remove → the confirmation sheet → the tile disappears and a green status appears; an unconfirmed send
   shows its dashed tile and the three exits.

Out of scope, seen while reading (from the spec's risks): `ConversationPointAsk` says "Server nije potvrdio mesto."
("server" wording, pinned by `conversation-point-ask.test.tsx:168`), and `ResolvedPinMap` prints coordinates under the
editable map. Both belong to their own owners.
