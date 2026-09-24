Every must-fix and should-fix item in the three reviews is done, and both cross-file items are finished. Types are clean. The full Jest run had 2 failures, both 5-second timeouts in suites this unit doesn't touch, and both pass when run alone. Nothing is pushed.

**Branch and commits**
- Branch: `g-round5d-kalendar`
- Worktree: `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN\.claude\worktrees\wf_6f7600b3-c18-2`
- `7dfcc154` is the interrupted wip commit. I checked it and kept it unchanged; I found nothing wrong in it.
- `a1ac60a13f5b6e4e05f5e594435a2ef07ee2bb9d` is my commit on top. The working tree is clean and the gitignored `entryReferenceData.ts` is not committed.

**Files changed from 644cab09**
- `src/app/(app)/profil/dostupnost.tsx`, `src/app/dizajn-kalendar.tsx`
- `src/contracts/projections.ts` (only the `tacanTermin` field), `src/data/agreementClientService.ts` (only its mapping), `src/data/lazniIzvor.ts` (only that field)
- `src/ui/calendar/`: `AgendaRow.tsx`, `AgendaScreen.tsx`, `AvailabilityForm.tsx`, `CalendarControls.tsx`, `agenda.ts`, `weekCopy.ts`
- `src/ui/system/Disclosure.tsx` (only the export)
- Tests: `agreement-exact-window-mapping.test.ts` (new), `availability-step10`, `dizajn-kalendar`, `pkg005-calendar-scope`, `w02-calendar-native`, `ui/calendar/__tests__/agenda`, `weekCopy`

My commit adds three things on top of the wip:
- The week strip's gap is 4 (`sys.space.xs`). The wip used half a step, which the 4/8 spacing rule doesn't allow; seven days still fit at 320 dp.
- The calendar's own styles use `sys.space` tokens.
- The gallery's Friday night is saved the way the Termin sheet saves it, so the part after midnight pairs with the night.

**Results**
- `npx tsc --noEmit -p tsconfig.json`: clean.
- Changed suites plus their neighbours: 15 suites, 290 tests.
  - All pass. Two timed out at 5 s under load: `v5-agreement-actions-screen` and `v5-review-screen`. Run alone: 72/72 pass.
- Full `npx jest`: Test Suites: 2 failed, 295 passed, 297 total. Tests: 2 failed, 5631 passed, 5633 total.
  - Both failures were 5 s first-test timeouts: `dizajn-obavestenja-gallery` and `own-task-menu-screen`. Run alone: 2/2 suites, 5/5 tests pass.
- The focused suites of the PKG-004 and PKG-007 proofs all passed in the full run. The CI proof runs themselves did not run, because I did not push.
- No emulator, build or iOS run.

**Flow review (tok)**
1. Copying a day cut shifts that run past midnight: **done.** The night and its after-midnight part are copied as one slot, and the "Zameniti termine?" question is read from the copy result, in both the form and the copy sheet. Tested in the logic and through the form.
2. The agreed time window was not wired into the Dogovori list: **done.** There is a mapping test and a gallery scene where the list gives no exact time.
   - The one tracked fixture in `outputs/` (`review.tsx`) still type-checks because the field is optional.
3. Capital weekdays mid-sentence: **done.** It now reads "Utorak, sreda, četvrtak i petak dobijaju iste termine kao ponedeljak."
4. The Back question claimed changes would be lost after an unconfirmed save: **done.** Neither the on-screen Back nor the hardware Back asks in that state. Tested.
5. Screen-reader way to refresh the calendar: **done**, tested.
6. "Bez tačnog termina" opens the whole Dogovori tab: **partly.**
   - There is no second Dogovori entry to fix: the tab navigator's history removes duplicates (I checked its code).
   - **Not done:** showing which of the Dogovori are meant needs a change to the Dogovori screen, which is not one of my files.
7. The "Mogu odmah" hint now says it applies once saved: **done.**
8. "Server" wording and jargon in `serverReceipt.ts`: **not done.** Not one of my files, and it was already there before this unit.
9. Profile conversation and missing work profile: **partly.**
   - Done: the disabled button's reason in the profile panel, and a screen with no work profile now leads to `/profil/radnik`.
   - **Not done:** the unsaved-change guard and the dead Save in `razgovor.tsx`. Not one of my files.

**Look review (izgled)**
1. Rows speak all their facts again (day, slot and special-date rows): **done**, tested.
2. A save is announced, the problem lines are live regions, and sheet errors are drawn by their button: **done**, tested.
3. The disabled reason in the profile panel names that screen's own action: **done**, tested.
4. The week label is never cut, and "Danas" moves under it on a narrow row: **done**, tested.
5. Day circles show one letter at a very large text size: **done**, tested.
6. The "Moja dostupnost za rad" row is spoken by its visible words: **done.**
7. Spacing from tokens: **done** in the files the review named, plus `CalendarControls`.
   - Two values stay as they were, because other screens draw them: the choice buttons keep the price filter's 14/10 padding, and the field labels keep their gap of 6.
8. The dot for a day with only finished work uses the muted grey: **done**, tested.
9. The switch is read once and its words are part of the touch area: **done**, tested.
10. The special-date choice reports `checked`: **done**, tested.
11. The gallery's back arrow goes home when opened cold by its address: **done**, tested.

**Guards review (zastite)**
1. The after-midnight slot is kept when a day is copied: **done** (same fix as flow item 1).
2. The iOS date/time picker change reaches other screens and no test covers it: **not changed.** It is recorded in `CalendarControls.tsx` as an iOS release gate; it doesn't affect Android.
3. The Back question: **done** (same fix as flow item 4).
4. My own Dogovor, marked done and waiting for the other side, now shows as waiting on the schedule: **done**, tested.
   - I checked the review's condition first: marking work done does not change the Dogovor's version. `rpc_mark_work_done` only changes the execution state, including after its later patch.
5. An untitled Dogovor from the list is no longer called confirmed: **done**, tested.
6. The window is wired and the `pkg005` test comment is reworded: **done.**
7. No visible retry after a failed re-read: **not changed.** It is the lead's call. Pull-to-refresh and the screen-reader action are still there.

**Cross-file items**
1. The agreed time window in the Dogovori list: **done** (flow item 2).
2. `TurningCaret` exported from `Disclosure.tsx` and used in `AvailabilityForm.tsx`: **done.**

**For the owner (none acted on)**
- "izuzetak" versus "poseban datum" on the same screen.
- The four names for the availability screen.
- What "Mogu odmah" means to other people.
- Saving "Mogu odmah" on its own would need a new server command.
- Whether the calendar's days follow Serbian days for people abroad.
- How to name a schedule's time zone outside Serbia in words.
- Whether past special dates are ever removed automatically.

**Still open**
- The emulator screenshot loop, using the gallery at `/dizajn-kalendar`.
- The iOS picker gate.
- The CI proof runs for PKG-004 and PKG-007, which start once the branch is pushed.