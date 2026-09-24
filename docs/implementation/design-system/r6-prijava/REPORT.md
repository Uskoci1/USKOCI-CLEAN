# Round 6 — unit `prijava` (application composer and rating)

Branch `work/uskoci-r6-prijava-20260924`, based on `ecb0f13` (`work/uskoci-ui-unification-20260924`). Spec:
`docs/implementation/design-system/r6-specs/prijava.spec.json`. No server, migration, Edge, key, guard or dependency
change.

## Commits

- `daf69d0`: the build: new composer module, recomposed rating screen, the `dizajn-prijava` gallery, and the tests.
- `d474612`: the fixes from the three-lens review.
- The commit that adds this report.

## Files changed

| File | Change |
| --- | --- |
| `src/ui/v2/ApplicationComposerPresentation.tsx` (new) | `ApplicationComposerPresentation`, `ComposerUnavailable`, `ApplicationDraft`, `composerDraftIssue`, `splitFirstSentence`. |
| `src/ui/v2/ApplicationSelectionPresentation.tsx` | Composer code removed. It re-exports `ApplicationComposerPresentation as ApplicationSelectionPresentation` as the same function (`export … from`) and imports `splitFirstSentence` from the new module, so there is no import cycle. The candidate list, candidate sheet, `SelectionFrame` and `SelectionUnavailable` are untouched. |
| `src/app/(app)/prilike/[id]/prijava.tsx` | Changed: the import, `ComposerUnavailable`, and one `refreshHelps` flag (a constant for the storage-failure sentence, with its words unchanged). `read`, `submit`, the journal, the fences, `reset`, `openApplications` and every other message are unchanged. |
| `src/ui/reviews/AgreementReviewScreen.tsx` | Logic unchanged: the command, `attemptRef`, the `reviewId` readback, the AppState effect (still no focus-token guard), and `enabled`/`editable`. Added: a person read (`readAgreement`, request counter, match on `targetAccountId && !viSte`), `photo`, `roleOf`, the `settled` label, and `backFromReviewToAgreement`. Drawing moved out. |
| `src/ui/reviews/AgreementReviewPresentation.tsx` (new) | The rating screen drawn from its state alone. It imports review types only, never the service. |
| `src/app/(app)/oceni-dogovor.tsx` | Adds `useIzvor().dogovor`, the `ProfilePhoto` slot and `agreementRole`. Opened from a Dogovor, Back opens that Dogovor even without history. The fallback now has the bar, a `StateView` and a green way back. |
| `src/app/dizajn-prijava.tsx` (new) | Gallery. |
| Tests | `application-selection-native`, `application-composer-read`, `review-screen`, `agreement-review-navigation`, `oceni-dogovor-route`, `agreement-review-screen`, `one-token-source` (scopes added), and the new `dizajn-prijava-gallery`. |

## Tests

- `npx tsc --noEmit -p tsconfig.json`: clean. This includes the tracked `outputs/native-product-review-20260922/review.tsx`.
- Full `npx jest -w 3 --testTimeout=30000` on `d474612`: **Test Suites: 299 passed, 299 total; Tests: 5772 passed, 5772 total**.
  - There was no first-run timeout.
  - The first full run, on `daf69d0`, found one real failure (`screen-titles-announce-themselves`: the person's name was a role-less `title`). It was fixed before that commit.

Test changes follow the spec's `testsToUpdate`, and no assertion was weakened:
- **Unchanged assertions:** every submit payload (`cenaRsd` 6000/10000/18000, `potrebaRevizija`, exact replay), every journal assertion and every navigation assertion are kept.
- **Route guard:** it is now called directly with bad drafts.
- **New cases:**
  - task face "Traži 3 osobe" and never "0 / 3";
  - stepper bounds, including invalid and too-large counts;
  - the reason for each invalid draft;
  - a task without a price;
  - success with SuccessMark and RSD;
  - the route refusing an edit while pending;
  - the person with name and role, a non-matching person, a failed read, a late read after unmount;
  - the saved view with the person;
  - the tag-limit reason;
  - Back from a Dogovor without history;
  - refresh offered or withheld depending on the state;
  - the gallery reaching no data service.

## Gallery: `uskociapp://dizajn-prijava`

It is guarded like `dizajn-tabla`: `__DEV__` or a `.dev` package, otherwise "Nije dostupno.".
- It opens as a list of scenes. Each row reads "Galerija: <scene>", and the row shows the scene name.
- Every scene has "Nazad na listu scena" at the bottom, and its own back arrow also returns to the list.
- It reads and writes nothing: the test makes the review, application, journal and supabase modules throw. Only the draft and the stars follow the fingers, locally.

Scenes: Ponuda: prazna · Ponuda: popunjena · Ponuda: neispravna cena · Ponuda: previše ljudi · Cena po osobi · Cena za ceo
zadatak · Zadatak bez cene · Radni profil nije aktivan · Zadatak ne prima prijave · Pregled pre slanja · Tačan termin · Slanje
· Ishod nepoznat · Ponovi istu prijavu · Odbijena ponuda · Prijava poslata · Prijava: učitavanje · Prijava: greška · Dugačak
naslov · Ocena: izbor · Ocena: tri oznake · Ocena: čuvanje · Ocena: ishod nepoznat · Ocena: sačuvana · Ocena: još nije
dostupna · Ocena: bez osobe · Ocena: učitavanje · Ocena: greška.

To open a sheet at once, the composer takes a gallery-only prop, `initialSheet`. A review opened that way is still retired by any change.

## Deviations from the spec, with reasons

1. **Field labels** are `bodyStrong` ink questions ("Ukupna cena za ljude koje dovodiš", "Koliko ljudi dolazi", "Termin",
   "Kratka napomena · nije obavezna"), not `variant="label"`. `label` is the 12 px letter-spaced style the owner rejected as eyebrows.
2. **The stepper reuses `ChromeIconButton`** (48 px touch area, 44 px circle, muted glyph when disabled) instead of drawing a new button in its look.
3. **The rating drawing is split into `AgreementReviewPresentation.tsx`** (a new file) so the gallery can draw every rating state without the review service. The screen keeps all logic.
4. **The rating person's role comes from the route** (`roleOf={agreementRole}`), not from an import in the screen.
   `AgreementPresentation` imports `ContextPhotos`, which imports the media service, which imports `supabaseClient`.
   That is the harness trap the spec warns about, and it was flagged by the `zastite` review.
5. **`photo` takes `(profileId, fallback)`.** The route cannot build the Avatar fallback without the initials, so the screen passes its Avatar.
6. **The composer summary for a task that names its price** says "Cena nije navedena" or "Cena zavisi od broja ljudi" instead of an accusation.
   An invalid typed price says "Cena nije ispravna".
7. **The tag-limit sentence** is "Izabrano je najviše: N oznake. Skini jednu da izabereš drugu." The spec's "Izabrane su 3 oznake" needs a verb that agrees with the count.
   `plural()` prints the count with the noun, and the plural guard forbids hand-written arithmetic.
8. **In the saved rating, the stars row is hidden from screen readers.** The visible line "Tvoja ocena: N od 5" is what is read, so it is not said twice.
9. **Back from a Dogovor without history now opens that Dogovor** (`backFromReviewToAgreement`) instead of the Dogovori list, so "Nazad na Dogovor" is true.
   The fallback, which has no session or no valid id, keeps the old way back.
10. **The composer gained two reasons** the route already enforced:
    - a per-person total above the 32-bit limit: "Ukupan iznos je veći nego što može da se pošalje. Smanji broj ljudi.";
    - a TOTAL-priced task with fewer free places: "Zadatak više nema sva mesta slobodna. Osveži Zadatak."

## Review → outcome

Verdicts: `tok` fix first, `izgled` fix first, `zastite` ship. Every item was checked against the code.

**tok**

| # | Finding | Outcome |
| --- | --- | --- |
| 1 | `placeholder="0"` next to RSD | fixed |
| 2 | Termin row dead after a retired review | fixed (`!reviewing`) |
| 3 | A missing price has no refresh, and "zadatak" was lowercase | fixed |
| 4 | The "repeat" sentence shows after a known refusal | fixed |
| 5 | "Osveži Zadatak" shows under a storage failure | fixed (route `refreshHelps`) |
| 6 | A closed task keeps an editable form | skipped. Locking the fields changes which message the route's own guard gives when the pinned test calls it directly (the price check runs first). The grey button and its reason already say the task is closed; left for the owner or emulator pass. |
| 7 | Note when a review is retired | skipped (new copy for a rare case; nit) |
| 8 | Tag-limit wording | fixed (deviation 7) |
| 9 | Cold-link Back lands on the list | fixed (deviation 9) |
| 10 | A deterministic refusal after an unknown outcome can only be replayed | skipped. It is existing behaviour that the spec keeps untouched; a follow-up. |

**izgled**

| # | Finding | Outcome |
| --- | --- | --- |
| 1 | Placeholder | fixed |
| 2–3 | Touch areas of neighbouring stars and chips overlap | fixed (`hitSlop={0}`) |
| 4 | Invalid price announced twice | fixed (hint on the input, no live region on the note) |
| 5 | Steps are not announced | fixed |
| 6 | Footer height with the keyboard up | fixed (the summary hides while the keyboard is shown) |
| 7 | Flat title hierarchy | fixed (the question is a heading when the person is shown) |
| 8 | Rating word only in the hint | skipped. The label "Ocena N od 5" is pinned by three suites and the spec asks for the word as the hint. |
| 9 | Termin row scales on press | fixed |
| 10 | Success re-announced on reopening | fixed |
| 11 | Spacing off the scale | fixed |
| 12 | Two notice colours | fixed (warnSoft) |
| 13 | `none` state is empty | fixed (drawn as loading) |
| 14 | Tapping the price box outside the input does nothing | skipped (nit) |

**zastite**

| # | Finding | Outcome |
| --- | --- | --- |
| 1 | Media import in the screen | fixed (deviation 4) |
| 2 | Refused edit while pending no longer pinned | fixed (test added) |
| 3 | Missing tests | fixed (tests added) |
| 4 | Saved view loses its way back on a later read failure | fixed |
| 5 | Per-person upper bound | fixed |
| 6 | Wording for a locked people count | fixed |
| 7 | One-render label latch | skipped (no effect on correctness) |

## Owner decisions left open

- **A written comment on a rating.** The brief asks for one, but `rpc_submit_agreement_review` carries only the rating and tags. A comment needs a server package covering: the column and its length, moderation and reporting, blocking, who sees it, and retention when an account is closed. That is a privacy and moderation decision. Not built.
- **Fees in the composer summary** (99 RSD connection fee, subscription, platform fee): waits for payment decisions P1–P12. The composer shows only the worker's own total.
- **Ratings revealed only once both sides have rated:** a business rule, unchanged.
- **Tag catalog:** it is owned by the server (`PRE_V3_REVIEW_TAGS_V1`, six tags, at most three).

## Outside this unit

- The offer edit in `MyApplicationsPresentation` has the same price and people fields. The stepper could move to `src/ui/system/Stepper.tsx` once it has a second user.
- `agreementRole` could live in a module with no dependencies (edit `AgreementPresentation.tsx`, which belongs to another area). Then the screen could import it directly.

## What the emulator check should look at

- **Composer at 320/360/390/430 dp and font scale 1.3 (`dizajn-prijava` scenes):**
  - a 10-digit price with "RSD";
  - the stepper, which must be 184 dp;
  - the footer summary wrapping onto two lines;
  - the footer while the keyboard is up (the summary is hidden, the reason stays);
  - the time sheet fields stacking below 360 dp or at scale 1.3;
  - the review sheet scrolling under its pinned footer.
- **The task face** at the top has no card and no tint, sits over a hairline, and says "Traži 3 osobe".
- **Rating:**
  - five stars fill 280 dp at 320 dp and are ≥ 48 each;
  - the orange stars are the only orange on the screen;
  - the 48 px chips, and the reason line once three are chosen;
  - the person row with a real photo;
  - the SuccessMark springs only right after saving;
  - Back labels: from Početna, from Dogovori and from a Dogovor, including a cold `uskociapp://oceni-dogovor?agreementId=…` link.
- **TalkBack:** the task face is read once; the steps are announced; the invalid-price hint; the stars' words as hints; "Prijava je poslata." is announced once.
