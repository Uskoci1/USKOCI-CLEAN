# Round 6 on the emulator — build b4531ef4 (run 36038648243)

**What was checked.** The Zadaci tab (a real signed-in screen) and the three round-6 galleries `dizajn-prijava`
(27 scenes), `dizajn-objava` (24) and `dizajn-dodaci` (28, the photo tray captured by hand), photographed on the QA
emulator (AVD USKOCI_V5_TEST, 1080×2424 at 420 dpi ≈ 412 dp, font scale 1.0, Europe/Belgrade) with build b4531ef4
installed by `adb install -r`. Contact sheets: `R6_ZADACI_b4531ef4.png`, `R6_PRIJAVA_b4531ef4.png`,
`R6_OBJAVA_b4531ef4.png`, `R6_DODACI_b4531ef4.png`. Every scene's screen-reader labels were dumped next to its picture
(kept in the session scratchpad; the receipt lists the counts).

**Method.** For each unit two independent critiques over the pictures (a UX lens and a visual lens), then a
code-aware skeptic per finding that opened the same picture and the source at `3ec4e6f1` (UI code = b4531ef4) and
ruled real / not real / already fixed / gallery-only. `FINDINGS.json` holds all 132 raised findings with their
verdicts; **113 are confirmed** (2 high, 36 medium, 75 low): Zadaci 7, prijava 30, objava 38, dodaci 38. Nineteen were
rejected (measured wrong, gallery fixture artefacts, moot because "Trenutna lokacija" is being removed, or already
handled at HEAD).

**Verdicts, one line each.** Zadaci: coherent and on-brand, not done (a selected pin hides a clustered second task; the
list vanishes without a trace while a pin card is up; the pin card is a second card anatomy). Prijava: close to done —
fix the sheet header first. Objava: right bones and honest states, but the unconfirmed-outcome review and the
place-saved screen would confuse a person today. Dodaci: honest states and a clean pill composer; the recovery and
Izmene flows speak process jargon; the group conversation drifts from the Poruke look.

## Fix first (high and medium), grouped by file

| # | Area | Screens | Defect | Where |
| --- | --- | --- | --- | --- |
| 1 | **ProductSheet header** (high) | prijava 10, 11 | the × close button drops under the green title on both sheets ("Ovo šalješ", "Tačan termin") — the header wraps into two rows | `src/ui/product/ProductSheet.tsx:143` |
| 2 | CalendarControls | prijava 11, dodaci 11 | time fields carry the calendar FactArt; use `clock` when `mode === 'time'` | `src/ui/calendar/CalendarControls.tsx:109` |
| 3 | Skeleton variants | prijava 17, objava 07, dodaci 05/15 | every loading state draws a task-card skeleton (avatar slot, chips) where the loaded screen is a flat list, facts or a preview card; add `thread` / `facts` / `preview` variants and pass them | `src/ui/system/Skeleton.tsx:25` + callers |
| 4 | StateView | prijava 18/25 | the block is indented ~4 dp past the gutter and its green action hugs the left instead of filling the width like every other primary | `src/ui/system/StateView.tsx:57` |
| 5 | Application composer | prijava 07 | "Cena nije navedena" and the helper right under it contradict each other; 13/14: a double hairline with an empty band under the task face; 01/06: the footer summary changes layout with text length; 19: the route fact truncates mid-word | `src/ui/v2/ApplicationComposerPresentation.tsx:384, 297, 421, 132` |
| 6 | Application route copy | prijava 14, 15 | "Aktuelne Prijave su proverene. Za potvrdu ishoda ponovi isti sačuvani zahtev…" is process jargon; "Osveži Zadatak" names a control that is not there | `src/app/(app)/prilike/[id]/prijava.tsx:158` |
| 7 | Publish review | objava 06 | two white buttons that do the same thing with different names and no primary; the same "not confirmed" fact said twice in two tones | `src/app/(app)/pregled-zadatka.tsx:451`, `src/ui/objava/ReviewPresentation.tsx:29` |
| 8 | Approximate map | objava 01 | the public map draws the approximate area with the same exact-looking orange pin (tail point) while the copy promises an approximate area | `src/ui/location/ResolvedPinMap.tsx:162` |
| 9 | Place form | objava 10, 13 | "Mesto rada" printed three times in a row; the locked review still looks fully editable (white input, active chevron) and the locked notice is a bare body line | `src/ui/location/NeedLocationForm.tsx:30, 128` |
| 10 | Task photos | objava 16, 18 | the failed tile is drawn like a neutral placeholder; the red status says "Slanje nije primljeno." while tile and footer say otherwise | `src/ui/objava/TaskPhotosPresentation.tsx:60`, `src/app/(app)/fotografije-zadatka.tsx:74` |
| 11 | Q&A recovery | dodaci 07, 08 | the recovery panel speaks in identifiers and "radnja"; the retry button is enabled over an empty, unlabelled field; every message is drawn red; the "needs a Radni profil" notice is a dead end | `src/ui/qa/TaskQaPresentation.tsx:67–76`, `src/ui/qa/TaskQaScreen.tsx:82–83, 189` |
| 12 | Izmene flow | dodaci 11, 12, 13 | step 1's only action is off-screen and step 2's sits at the top — no pinned footer (add one shared `FlowFooter`); the unknown-outcome state does not name the action | `src/ui/agreements/AgreementActionsPresentation.tsx:94, 174, 191` |
| 13 | Group conversation | dodaci 23 | thread anchored to the top while Poruke anchors to the composer; refresh floats in the stream and shows on a finished conversation; header copy on a 16 dp gutter | `src/ui/groups/GroupConversationPresentation.tsx:128, 145` |
| 14 | Photo tray | dodaci 28 | "Ukloni" is an ink caption, not a command; the tools go grey with no reason while a photo pends (hidden by the fixture) | `src/ui/media/AgreementPhotoComposer.tsx:26, 58` |
| 15 | Map attribution | zadaci 01, objava 01, dodaci 18 | the library "i" button (English label, off-palette blue in ResolvedPinMap) next to the text credits; tint it or drop it, and give the credits a 48 dp target | `src/ui/v2/DiscoveryMap.tsx:244`, `src/ui/location/ResolvedPinMap.tsx:155` |
| 16 | Zadaci pin card | zadaci 01 | a second card anatomy for the same task (plain meta line, price bottom-left); the sunk sheet leaves no trace of the list; a selected pin over a cluster hides the count | `src/ui/v2/discovery/DiscoveryPeek.tsx:69`, `DiscoveryPresentation.tsx:255`, `DiscoveryMap.tsx:276–306` |

The 75 low findings (wording, punctuation, duplicated reasons, gutters, one-off tones) are listed in `FINDINGS.json`
under `confirmed` with file and line; most fall into the same files as the rows above and should be taken in the same
pass per file.

## Not covered by this check (still owed)

- Only one width (≈412 dp) and font scale 1.0. The unit reports ask for 320 / 360 / 390 / 430 dp and font scale 1.3
  (`adb shell wm density 540/480/443/402`, `settings put system font_scale 1.3`); the "Veliki tekst" scene was captured
  at 1.0 with the stacked layout forced.
- Galleries use invented data. Real flows were not driven: ask / answer / skip / report on a real task, the Izmene
  form and review on a real Dogovor, "Dodaj mesto" → place → Back, an actual photo send, the rating after a real
  Dogovor and its cold deep link. Only the Zadaci tab is a real screen.
- TalkBack was not driven; only the accessibility tree was dumped per scene (the labels next to each scene).
- Two prijava scenes were not captured by the walk ("Slanje", whose entry moves while it plays, and one rating
  state); the gallery's own "Nazad na scene" exits are the only safe way out of a scene — Android Back on a gallery
  scene leaves the app (gallery-only behaviour).
- The emulator went all-black twice tonight (every window, even Settings); it was the emulator's GPU state saved into
  its quick-boot snapshot after ~60 cold starts, cured by `-no-snapshot-load`. Not an app defect; recorded in the
  tooling caveats.

## How to continue (Claude or Codex)

1. Take the rows above per file, one writer per file; keep every guard, server call, recovery, revision and test
   intent (the skeptics named the pinned strings and tests for each fix in `FINDINGS.json`).
2. `npx tsc --noEmit -p tsconfig.json`, full Jest, push (fetch + merge first, no rebase, no force), dispatch the
   emulator APK, re-walk the galleries and the Zadaci tab, and repeat the critique on the new build.
3. The owner's evening decisions (remove "Trenutna lokacija", no place checkbox, "U blizini", comment with a rating)
   touch `NeedLocationForm`, `mesto-zadatka`, `dogovor/[id]` and Discovery — coordinate those files with whoever
   builds them; the removal checklist for "Trenutna lokacija" is in `FINDINGS.json` (the lokacija skeptic's last entry).
