**Verdict: fix first.** One small correctness regression in the new overnight-copy logic. It's a one-line fix plus one test. Everything else claimed holds.

Worktree: `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN\.claude\worktrees\wf_6f7600b3-c18-2`, branch `g-round5d-kalendar`, HEAD `a1ac60a1`, compared against `644cab09`.

**What I ran**
- `tsc --noEmit`: clean.
- The changed suites plus every suite importing a changed module (agreementClientService, lazniIzvor, Disclosure, `ui/calendar/*`, dostupnost, the gallery, `tacanTermin`, the cdl-a01/02/06/07/08 equivalence suites, PKG-003/005/007/011/036, the m02/m04/m07/r02 suites, profile-hub, worker-profile, SupportScreens, one-token-source): 40 suites, 858/858 pass.
- Neighbouring suites that share the date/time field or show Dogovori (application composer and selection, AI intake, home, inbox, task detail, agreement collection and review navigation, session-layout, retired-discovery-routes and others): 15 suites, 356/356 pass. I ran them with a 30 s timeout, and nothing timed out.

**Issues, most severe first**

1. **Medium, fix first: copying a day can change the source day.** In `...\wf_6f7600b3-c18-2\src\ui\calendar\weekCopy.ts:39-49`, the branch for the part after midnight drops any day it owns whose night is removed, even when that day is the source.
   - To reproduce: Monday 22:00–24:00 `[1]`, its part after midnight 00:00–06:00 `[2]` dated one day later, and Tuesday 09:00–17:00 `[2]`. Then tap "Isto za sve radne dane" from Tuesday, which runs `copyDay(rules, 2, [1,3,4,5])`.
   - Result: after-midnight part `[1,3,4,5]`, day `[1..5]`. Tuesday loses its own 00:00–06:00, while the question says "Ponedeljak, sreda, četvrtak i petak dobijaju iste termine kao utorak."
   - The code before this fix gave `[1..5]`, so this is a regression. It breaks the file's own promise that the source day is never a target.
   - I reproduced it by running the committed code through the TypeScript compiler.
   - **Fix:** change line 44 to `...(rule.weekdays.includes(source) ? [source, ...into] : []),`. I checked that every expectation in `weekCopy.test.ts` still holds with this change, and that the case above stays the same when copied twice.
   - **Test to add to `weekCopy.test.ts`:**
     ```ts
     it("never changes the source day, even when its 00:00 slot ends a target's night", () => {
       const week = [night([1]), after([2]), rule('day', [2], '09:00:00', '17:00:00')];
       expect(copied(week, 2, [1, 3, 4, 5])).toEqual({ cont: [1, 2, 3, 4, 5], day: [1, 2, 3, 4, 5] });
       expect(copyTakesAway(week, 2, [1, 3, 4, 5])).toBe(true);
     });
     ```

2. **Low: a waiting schedule row with an empty title still says it is confirmed.**
   - In `src/ui/calendar/agenda.ts:94-95`, when the match is `AWAITING_REQUESTER` and `naslov` is empty, the row shows "Potvrđen Dogovor" beside "Čeka se potvrda završetka".
   - `AgendaRow.tsx:44-45` also speaks it as "Otvori Dogovor sa potvrđenim terminom".
   - **Fix:** `fallbackTitle: match && match.stanje !== 'CONFIRMED' ? LIST_FALLBACK_TITLE : SCHEDULE_FALLBACK_TITLE`.

3. **Low, check on the emulator: the screen-reader refresh may be unreachable.**
   - `AgendaScreen.tsx:86` puts `accessibilityActions` 'activate' on a ScrollView. `AvailabilityForm.tsx:396` already did the same before this unit.
   - TalkBack usually doesn't focus a ScrollView that isn't marked accessible, so the action may never be offered. The test only calls the handler directly.
   - Check it with TalkBack in the emulator loop. If it can't be reached, guards item 7 (a visible retry) is no longer optional.

4. **Nit: the no-profile branch matches on the error's wording.**
   - `src/app/(app)/profil/dostupnost.tsx:72` compares `editor.error` to the words 'Najpre sačuvaj svoj radni profil.'.
   - A test reads the service's source file to keep the two copies equal, which works but is brittle. Exporting the message from `workerAvailabilityClientService` would be cleaner.

5. **Nit: a test can leak its router change.** `src/data/__tests__/dizajn-kalendar.test.tsx:72` puts `router.canGoBack` back only if the assertions pass. Use `try`/`finally`.

**Review items checked in the code**

Flow review:

| # | Status | Where |
|---|---|---|
| 1 | Done, but see issue 1 | `weekCopy.ts:26-69`, `AvailabilityForm.tsx:233,355` |
| 2 | Done | `projections.ts:393`, `agreementClientService.ts:132-136` (inside `mapAgreement` only), `lazniIzvor.ts:291-293`, `agreement-exact-window-mapping.test.ts`, gallery scene `dizajn-kalendar.tsx:128` |
| 3 | Done | `AvailabilityForm.tsx:40-43,357` |
| 4 | Done | `dostupnost.tsx:20,42,52`, tested |
| 5 | Done | `AgendaScreen.tsx:86-87`, but see issue 3 |
| 6 | Partly | The Dogovori screen is outside this unit |
| 7 | Done | `AvailabilityForm.tsx:367-369` |
| 8 | Not done | `serverReceipt.ts` is outside this unit |
| 9 | Partly | Done: `AvailabilityForm.tsx:384-385`, `dostupnost.tsx:72`. Not done: the unsaved-change guard and dead Save in `razgovor.tsx`, outside this unit |

Look review:

| # | Status | Where |
|---|---|---|
| 1 | Done | `AvailabilityForm.tsx:417,435-436,470-471` |
| 2 | Done | `:319`, `:378`, `:401`, and `SheetFooter` at `:90` passes the error to V2Action, which draws it as an alert with a polite live region |
| 3 | Done | `:384-385` |
| 4 | Done | `AgendaScreen.tsx:51,93,99` |
| 5 | Done | `AvailabilityForm.tsx:140` |
| 6 | Done | `AgendaScreen.tsx:129` |
| 7 | Done | Only the two stated exceptions remain: `CalendarControls.tsx:30,73,105` |
| 8 | Done | `AgendaScreen.tsx:117` |
| 9 | Done | `AvailabilityForm.tsx:64-75` |
| 10 | Done | `:202` |
| 11 | Done | `dizajn-kalendar.tsx:158` |

Guards review:

| # | Status | Where |
|---|---|---|
| 1 | Done, but see issue 1 | Same fix as flow 1 |
| 2 | Recorded as a release gate | `CalendarControls.tsx:116` |
| 3 | Done | Same fix as flow 4 |
| 4 | Done | `agenda.ts:90-95`. I confirmed in the migrations 20260829183947 and 20260908120000 that `rpc_mark_work_done` only updates `agreement_execution`, so the version doesn't change |
| 5 | Done | `AgendaRow.tsx:44-52` |
| 6 | Done | `pkg005-calendar-scope.test.tsx:62-64` |
| 7 | Not changed | The lead's call |

Cross-file items:
- The agreed time window is done. The server's list read sends `av.terms` of the current version (`pkg023a_own_reads_paged.sql:266`), so `tacanTermin` comes from the accepted terms. The tracked fixture `outputs/native-product-review-20260922/review.tsx` still type-checks.
- `TurningCaret` is exported (`Disclosure.tsx:52`) and used in `AvailabilityForm.tsx:13,423`.

**Boundaries**
- **Guards and save path:** unchanged. `expectedRevision`, `noviUuidZahtevId`, `useOwnedEditor`, the save refusals and the schedule's same-id, same-version rule are all intact.
- **Scope:** no legal, privacy or consent text changed, and no dependency was added. No "server" wording or gendered form was added.
- **Tests:** they were updated with comments where they pinned the old labels, and none was weakened.
- **Files:** all 19 are inside the fixer's allowed list.
- **Line endings:** no CR in any changed blob, the same as the base.
- **Commits:** the working tree is clean. The two commits carry different author emails (`agent@local` and `agent@uskoci.ai`), and the wip commit's message says "unverified". Consider squashing them when this goes to integration.

**Still open, as the fixer said:** the emulator screenshot loop, the iOS picker gate, and the PKG-004 and PKG-007 CI proofs, which start once the branch is pushed.