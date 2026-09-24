**Verdict: fix first.** Two small accessibility fixes are needed, both in files the fixer owns. Everything else can be done during the emulator loop.

I checked `a1ac60a1` on `g-round5d-kalendar` in the fixer's worktree. `npx tsc --noEmit` is clean. I ran the 10 changed or neighbouring calendar suites in band: 141/141 pass. The fixes for the three reviews are in the code as reported, with these exceptions.

**1. Fix first: the "screen-reader refresh" does not work on a phone.**
- **Where:** `src/ui/calendar/AgendaScreen.tsx:86-87` (flow review item 5, reported "done, tested") and the older one at `src/ui/calendar/AvailabilityForm.tsx:396-397`.
- **Why Android never offers it:** React Native's `ReactScrollView` sets its own `ReactScrollViewAccessibilityDelegate` when it is created. `ReactAccessibilityDelegate.setDelegate` then skips any view that already has a delegate ("if a view already has an accessibility delegate … leave it alone", `node_modules/react-native/.../uimanager/ReactAccessibilityDelegate.kt:587-608`). The scroll delegate never reads `accessibility_actions`, so TalkBack never sees the action.
- **Why iOS doesn't either:** on iOS a ScrollView is not an element VoiceOver can focus.
- **What the tests prove:** only that the prop is there.
- **What it breaks:** the guards review's item 7 (no visible retry after a failed re-read) was left to the lead on the assumption that this action exists.
- **Fix:**
  - Move it to a focusable element and give it a custom name, so the element does not become "clickable". For example, on the day heading at `AgendaScreen.tsx:121`: `accessibilityActions={[{ name: 'refresh', label: 'Osveži raspored' }]} onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'refresh') onRefresh(); }}`.
  - In `AvailabilityForm`, put the same action on the "Redovna nedelja" header (`:407`), with `name: 'refresh'` and the existing `!dirty` condition. Also add a quiet `V2Action label="Pokušaj ponovo" kind="quiet" compact` beside the problem line (`:401`) when `onRefresh && !dirty`. That line tells people "…pokušaj ponovo" but shows no control.
  - Update the w02 test to find the action on the header, not on the ScrollView.

**2. Fix first: the "Mogu odmah" explanation is now hidden from screen readers when hints are off.** `AvailabilityForm.tsx:64-75`, `SwitchRow`.
- The Press sets `no-hide-descendants` on both the label and the hint text. The hint then only reaches a screen reader as the Switch's `accessibilityHint`. Android turns that into `tooltipText`, which TalkBack reads only as a usage hint, and on iOS people can switch hints off.
- So the draft-profile warning ("Radni profil je nacrt…") and "važi kada sačuvaš…" can go unheard. This is the same reason the fixer moved the day-row slots from hint to value.
- **Fix:** hide only the label (`<T accessibilityElementsHidden importantForAccessibility="no">`). Make the Press `importantForAccessibility="no"` without hiding its descendants, so the hint text is read as its own line. Pass no `hint` to `FormSwitch`, so nothing is read twice.

**3. Low: a copied night is not fully described.** `AvailabilityForm.tsx:231, 248, 357`.
- After the midnight fix, copying a night adds its after-midnight part to the day *after* each chosen day. For example, Friday's night now puts 00:00–06:00 on Saturday.
- Neither the copy sheet's summary ("Ponedeljak: 22:00–24:00"), nor the "Zameniti termine?" question, nor the announcement mentions it. Someone will see a Saturday slot they didn't set.
- **Fix:** when the source has a night (from `weekCopy`'s `nightsOf`, exported), add the note "Noćni termin se nastavlja do {kraj} sledećeg dana." to the sheet and the question.

**4. Low: missing work profile looks like an error.** `src/app/(app)/profil/dostupnost.tsx:71-73`.
- It is a precondition, but it is drawn as `kind="error"` with the title "Dostupnost nije učitana.", which is untrue in this case.
- **Fix:** for `PROFILE_REQUIRED`, use `kind="empty"` and the title "Najpre sačuvaj svoj radni profil.", with no repeated body. Mirror it in the `bezProfila` gallery scene.

**5. Low: "Danas" sits 16 dp to the right of the week label on narrow rows.** `AgendaScreen.tsx:157`.
- The quiet button has its own 16 dp inset.
- **Fix:** `todayLine: { flexDirection: 'row', marginLeft: -sys.space.base }`, as `dayActions` already does.

**6. Low: the finished dot has two colours.** `src/ui/calendar/AgendaRow.tsx:61` still draws it in `lineStrong` (about 1.4:1), while the week strip now uses `muted`.
- **Fix:** `waiting ? sys.color.orange : sys.color.muted`.

**7. Low, gallery only: the reason points at a button the scene doesn't have.** `src/app/dizajn-kalendar.tsx:139`.
- The "razlog" scene's reason says "Prvo proveri stanje razgovora", but the scene has no such button, so the emulator shot would show a reason pointing at nothing.
- **Fix:** add `<V2Action label="Proveri stanje razgovora" onPress={noop} />` under the form, as `razgovor.tsx:190` does.

**8. Low, older code: an off switch is hard to see.** `AvailabilityForm.tsx:58`. The off track (`lineStrong`) on white is about 1.4:1, the same contrast problem that was fixed for the dot.
- **Fix:** `false: sys.color.muted` for `trackColor` and `ios_backgroundColor`.

**Still open, as the fixer reported:**
- The "Bez tačnog termina" row still opens the whole Dogovori tab without marking which Dogovori are meant. That needs a change to the Dogovori screen.
- The "server" wording and jargon in `serverReceipt.ts`.
- The unsaved-change guard and the dead Save in `razgovor.tsx`.
- The iOS picker gate.
- The CI proofs for PKG-004 and PKG-007.
- The emulator loop at 320/360/430 dp and text size 1.0/1.3, including a TalkBack pass on the day, rule and special-date rows.

**Checked and correct:**
- Rows speak their facts, and the special-date choice reports `checked`.
- A save is announced (candidate mode never passes `saved`), and sheet errors are drawn by their button.
- The profile panel's disabled reason names its own screen's check. Day circles show one letter at 1.5; the week label is never cut.
- Weekdays are lower-case mid-sentence. Back skips the question after an unconfirmed save, and the gallery's back arrow goes home when opened cold.
- `TurningCaret` is exported and turns only on a real change.
- Changed values are on the `sys.space` scale, with the two documented exceptions. No text is under 12 px, no new orange fill, and no "server" or orientation copy was added.