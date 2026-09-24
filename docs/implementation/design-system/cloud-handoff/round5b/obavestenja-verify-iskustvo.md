**Verdict: fix first.** Items 1 to 4 are small, and all four are visible on the QA emulator with DEV today. Two of them are accessibility regressions this branch introduced (items 2 and 4).

I reviewed branch `g-round5d-obavestenja` (`dd9998b4`) read-only in `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN\.claude\worktrees\wf_6f7600b3-c18-3`.

**My test run:** I ran the 8 changed suites one after another with `--runInBand`. Result: 7 suites passed, 1 failed; 111 tests passed, 1 failed. The failure was a 5 s timeout in `push-preferences-native.test.tsx:148`, a test the fixer did not touch. Run alone, that suite passes 36/36, but that one test takes 4801 ms.

**Remaining issues, most severe first**

1. **Medium: the new phone line contradicts the send check on the same screen.**
   - Where: `src/ui/notifications/PushPreferences.tsx:343` and `:349`, against `:320`.
   - The new body line says "Slanje na telefon je uključeno za Moje zadatke.". At the bottom of the same screen, the send check for `NOT_READY` says "Slanje obaveštenja na telefon još nije uključeno.".
   - DEV's sender is switched off (PKG-030), so the check reads `NOT_READY` (`DEPLOYMENT_DISABLED`) right now. The emulator (`UNSUPPORTED`) with a set that has sending on shows both sentences together.
   - Fix: keep "slanje" for the send check only, and say the account's choice with the buttons' own noun:
     `const choice = enabled ? \`Obaveštenja na telefon su uključena za ${set}.\` : \`Obaveštenja na telefon su isključena za ${set}.\`;`
   - Add a gallery scene with `native: 'UNSUPPORTED'`, `enabled: true` and `readiness: { state: 'NOT_READY' }`. The gallery currently never draws this state: `dizajn-obavestenja.tsx:172` sets `enabled: native === 'READY'` and only uses an `OPERATIONAL` readiness.
   - List the `NOT_READY` sentence (`:320`) for the owner too. It reads like the account's own switch.

2. **Medium: switching the inbox filter loses the screen reader's place.**
   - Where: `src/app/obavestenja.tsx:68` and `src/app/dizajn-obavestenja.tsx:155`.
   - `key={role ?? 'ALL'}` remounts the whole `InboxList`, including the header with the filter tabs. The tab TalkBack just activated is destroyed, so focus is lost and "Moje prijave, izabrano" is never spoken.
   - Fix: remove the key in both places. Reset the baseline inside the hook instead: give `useArrivals(items, list: string)` a `listRef`, and when `list !== listRef.current`, set `listRef.current = list; newest.current = null;`. Call it as `useArrivals(items ?? [], role ?? 'ALL')` at `InboxPresentation.tsx:182`.
   - This is safe because `useInbox` builds a new model with `page: null` for each filter. With `before === null`, every item of the new first page is marked seen, so nothing animates.
   - The existing test at `inbox-native.test.tsx` ("a new filter's first page stays still") keeps passing.

3. **Low-medium: after an unconfirmed save, Back says the changes were not saved.**
   - Where: `PushPreferences.tsx:164`.
   - After a failed or timed-out save, `dirty` stays true and `busy` is false. Back, Android Back and the set tabs then ask "Odbaci izmene? Izmene kategorija i tihih sati nisu sačuvane.", but the outcome is unknown. "Nastavi uređivanje" also leads back to a fully locked screen, where "Proveri stanje" replaces the draft anyway.
   - Fix: `const unsaved = dirty && !busy && !error;`.

4. **Low-medium: a wrong sentence is still spoken after every phone command.**
   - Where: `PushPreferences.tsx:245`.
   - `saveReason` is null while `busy`. After "Osveži stanje", "Uključi…", "Poveži ovaj telefon", "Isključi…" or the automatic re-read on return to the app, it comes back, and `useAnnouncedReason` speaks "Dugme se uključuje kad promeniš neko podešavanje.". After "Uključi obaveštenja" that sentence is actively confusing. This is the same defect as the save case the fixer fixed.
   - Fix: `const saveReason = error ? CHECK_FIRST : dirty || justSaved || working === 'save' ? null : 'Dugme se uključuje kad promeniš neko podešavanje.';`

5. **Low: the unconfirmed state speaks "Prvo proveri stanje." twice, right after its alert.**
   - Where: `PushPreferences.tsx:242`, `:264` and `:245`.
   - The first waiting phone button and Save both get the reason at the same moment, and V2Action announces each one.
   - Fix: while `error`, give the phone button no reason, because the alert and "Proveri stanje" stand directly above it: `const waitReason = dirty && !error ? SAVE_FIRST : null;`. Keep `CHECK_FIRST` on Save.

6. **Low: on Profil, every row tap now turns all icons grey during the exit transition.**
   - Where: `src/ui/settings/SettingsPresentation.tsx:91`, together with `src/app/(app)/profil.tsx:53-56` and `:97`.
   - `navigate` calls `setBusy(true)`, and every `SettingsRow` receives `disabled={busy}`. The about 9 coloured FactArts go muted during the `shift` push transition. Before this change only the labels went grey.
   - Fix (step 9's file): do not pass `busy` as `disabled` for the navigation lock, since `beginAction` already refuses a second tap. Otherwise, take an emulator screenshot of Profil before shipping.

7. **Low: the blocked-person row has two trailing controls.**
   - Where: `SettingsPresentation.tsx:139-150`.
   - The chevron (`:144`) sits mid-row, directly before the bordered "Odblokiraj", and reads as pointing at the button.
   - Fix: use the large-text layout at every size, with the action under the name (`personActionLarge`), so the chevron ends the person's row. Otherwise, drop the chevron and keep the `openHint`.

8. **Low: the set tabs are silently dead during a write.**
   - Where: `src/app/(app)/profil/obavestenja.tsx:72`.
   - `pointerEvents="none"` gives no visual or `accessibilityState` disabled state. TalkBack's double-tap still reaches the tab, and `requestRole` then does nothing.
   - Fix: add a `disabled` prop to `Segmented` (muted labels and `accessibilityState.disabled`), or at least set `accessibilityState={{ disabled: writing }}` on the wrapper.

9. **Low: an empty first page that has a next page draws only a lone button.**
   - Where: `src/ui/settings/BlockedAccountsList.tsx:28` and `:57`.
   - The screen shows "Sledeći korisnici" with no words. This happens, for example, after unblocking the only person on page 1 when the re-read fails and the fallback keeps `nextCursor`.
   - Fix: in that case, draw "Na ovoj stranici nema više korisnika." without "Početak liste".

10. **Low: the connected-phone headline is long and inconsistent.**
    - Where: `PushPreferences.tsx:350`.
    - "Obaveštenja na telefon su uključena za Moje zadatke." wraps to 3 lines of 16/600 at 320 dp and to 4 at text scale 1.3. The set is already named by the selected tab just above it.
    - Only these two titles end with a period; the others ("Ovaj telefon još nije povezan", "Nije dostupno na ovom uređaju") do not.
    - Suggestion for the owner: a short title without a period, and the set in the body.

11. **Nit: the inbox icon sits 6 dp below the unread dot.**
    - Where: `InboxPresentation.tsx:258`.
    - `art.paddingTop` changed from 2 to `space.xs` (4). The icon's centre is now 6 dp below the dot's centre, which sits on the title's first line (it was 4 dp). `paddingTop: 0` is also on the scale and aligns them better.

12. **Info: another flaky test and a platform gap.**
    - `push-preferences-native.test.tsx:148` has the same flake pattern as the gallery test. Give it an explicit timeout, as was done for the gallery.
    - The saved line (`PushPreferences.tsx:330`) relies only on `accessibilityLiveRegion`, which iOS ignores. If iOS matters, also announce it once through `AccessibilityInfo.announceForAccessibility` when `justSaved` turns true.

**Still unverified:** no emulator screenshots of any settings screen at 320–430 dp or at text scale 1.3, and where Back lands after the inbox gear.

**Checked and correct:**
- The `skup` parameter is replaced on each navigation, not merged (verified in the expo-router `TabRouter`), so a set named once never sticks to a later visit from Profil.
- The spinner now goes to the command that actually runs.
- The blocked list's unblock fallback, its lock while the list shows an error, and its empty-page logic for later pages.
- The O aplikaciji heading, the own-account empty state and "Nastavi uređivanje".
- The note under the first category group, the double fade removed, and FactArt muted on a disabled row.
- No colour or font size outside the tokens, no "server" wording and no gendered forms in the new copy.
- Test changes only replace assertions that pinned the old look ("Nazad na profil", "Pokušaj ponovo"), each with a comment.