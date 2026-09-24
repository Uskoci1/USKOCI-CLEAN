Every review item except two is fixed and committed. Those two stay open: I could not check the screens on the emulator, and the country codes on the AI card belong to the razgovor unit. Types are clean. The full Jest run passed except for six 5 s timeouts, all outside this unit, and those six pass when re-run alone.

- **Branch:** `g-round5d-profil`, not pushed
- **Commits:**
  - `cd82c078`: the interrupted fixer's wip, kept unchanged. I checked it item by item, found nothing unsound, and it covers most of the reviews.
  - `21d7448d`: my commit on top, "ui: finish the step 9 review fixes (profile, worker profile, photo, area, name)".
- **Worktree:** `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN\.claude\worktrees\wf_6f7600b3-c18-1`. The node_modules junction was already there. `entryReferenceData.ts` is present and gitignored, not committed. All changed files are still CRLF.

**Files changed since 644cab09:**
- Routes: `src/app/(app)/profil.tsx`, `profil/fotografija.tsx`, `profil/lokacija.tsx`, `profil/radnik.tsx`, `src/app/dizajn-profil.tsx`
- Components: `src/ui/profile/DisplayNameForm.tsx`, `ProfileHubPresentation.tsx`, `ProfilePhotoPresentation.tsx`, `src/ui/reviews/AccountReputation.tsx`, `src/ui/system/PickerTile.tsx`, `src/ui/workerProfile/WorkerAiPresentation.tsx`, `WorkerProfilePresentation.tsx`
- Tests: `personal-profile-route`, `pkg011-slice5-presentation`, `profile-gallery`, `profile-hub`, `v5-avatar-screen`, `worker-area-route`, `worker-profile-native`, `review-screen`, `worker-ai-review`

**Results:**
- `npx tsc --noEmit -p tsconfig.json`: clean.
- Changed suites and suites that import changed modules: all pass. I ran 19 suites; three of them first timed out under load and passed when re-run in band.
- Full `npx jest`: Test Suites 6 failed, 290 passed, 296 total; Tests 6 failed, 5617 passed, 5623 total.
  - All six failures were 5 s timeouts while the machine sat at 100% CPU from other agents: auth-entry-surface, data-export-screen, my-applications-native, pkg011-agreement-workspace, publication-screen, SupportScreens.
  - Re-run alone in band, all six pass: 231/231 tests. That makes 296/296 suites and 5623/5623 tests.

**My commit (`21d7448d`):** the worker profile frame's sticky footer steps aside while the keyboard is up. It is hidden, not removed, so buttons keep their state and nothing is announced twice. It returns when the keyboard closes and starts shown. One new test covers it.

**Flow review (tok):**
1. Photo dead end after a denied camera, a too-large file or a failed preparation: done. Nothing was written, so it now settles like a cancelled pick and the choice stays open under the message.
   - Not done as suggested: I did not pass "Izaberi iz galerije" to the permission box. That button is already the one primary right below it, and a copy would be a second control for the same job.
2. Area footer after a save: done. "Područje rada je sačuvano." now stands in place of the confirmation until something changes, and the line at the top of the body is gone.
3. Silent save during a re-read: done.
   - The area and name saves wait and say "Učitavamo sačuvano područje…" / "Učitavamo sačuvano ime…".
   - A failed re-read now offers "Učitaj sačuvano stanje".
4. Sticky footers at 320 dp with the keyboard open: done in code (the footer steps aside). Not checked on the emulator.
5. Photo copy contradicting its buttons: done. The line reads "Promena još nije potvrđena." when a retry is offered, and the caption reads "Šaljemo fotografiju…" while sending. The owner should confirm this wording.
6. Support link copy: done, now "Sačuvaj unos pre nego što pišeš podršci."
7. "Sve je spremno za aktivaciju." is shown only when the primary really is the activation: done. A draft without a loaded capacity now says "Kapacitet profila još nije učitan."
8. Stepper with a typed 51–999: done. Minus goes to 50 and plus stays grey.
9. Hub "Područje rada" row with no area: done, it says "Nije podešeno".
10. `ReputationLine` printing "undefined": done, and it is now tested directly.
11. Country codes on the AI card: not done. It is left to the razgovor unit, because `countryName`'s imports reach `supabaseClient` and crash the screen suites.

**Look review (izgled):**
1. Invented "Profil je aktivan." for an unknown state: done, plus a test.
2. Photo recovery label: done. The read is labelled "Nazad na izbor fotografije", or "Proveri sačuvanu fotografiju" when the saved photo cannot be read.
3. Sticky footers at 320 dp: done in code, same fix as flow #4. Emulator check pending.
4. An upload in flight looking like an unknown outcome: done.
5. Gallery test that could not catch a read: done. Client calls and storage writes are counted and must stay at zero. The map comment is corrected.
6. Long names cut off: done. A name over 24 characters takes the full width under the photo, up to 3 lines.
7. Gallery "Nazad" doubling the bottom inset: done. It now sits over the top bar's right side.
   - Side effect: at 320 dp it may cover the end of a long title in gallery screenshots only.
8. Spacing off the scale: done.
9. Raw type sizes in PickerTile: done. Medium tile labels are now 15/22 instead of 15/20, and the row layout's labels 16/24 instead of 16/21. Two-line labels grow a few dp, dizajn-tabla included.
10. Screen reader could not reach the "unavailable" photo circle: done.

**Guards review (zastite):**
1. Invented status: done, plus a test with an unknown state.
2. Two filled primaries on the photo screen: done. A denied camera now stays in pick mode, where "Podešavanja telefona" is a white button beside the one green "Izaberi iz galerije".
3. Save enabled during a re-read, and no retry after a failed read: done, plus tests.
4. Rule dates without a year: done. The year shows only when it is not the current one, plus a test.
5. Hub test relying on the shared resource mock: done. The rating is now a named element in the hub suite and the line is tested on its own.

**For the owner (nothing changed without asking):**
- "obustavljen" on the hub versus "suspendovan" on the worker screen.
- Licences: the empty word went back to "Nisu navedene", since licences are the owner's wording.
- Lines the spec removed as orientation copy:
  - The hub row detail "Ime koje prikazuješ uz svoje zadatke." The name screen still says who sees the name.
  - On the area screen: "Ovo je područje rada. Dostupnost, slobodni termini i obaveštenja podešavaju se zasebno." and "Izaberi područje u kom radiš."
  - On the worker screen: "Dostupnost nije uslov za aktivaciju."
  - The worker screen's "Pogledaj raspored" link. The hub still opens `/raspored`.
- The area confirmation is read aloud as "Potvrđujem unetu lokaciju", which does not match what the screen shows. That label lives in the shared `LocationControls`, outside this unit, and the wording is the owner's.
- New app copy to confirm: "Nazad na izbor fotografije", "Promena još nije potvrđena.", "Šaljemo fotografiju…", "Kapacitet profila još nije učitan.", and the two "Učitavamo…" reasons.

The emulator loop is still to do: 320/360/390/430 dp, font scale 1.3, long names, and the keyboard with the footers.