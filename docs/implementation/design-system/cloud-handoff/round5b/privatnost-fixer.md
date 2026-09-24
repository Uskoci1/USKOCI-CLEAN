The round 5 review fixes for privacy, export, legal documents, account closure and support are finished and committed. The earlier fixer's interrupted work was sound and I kept all of it. I corrected one thing in it (how an unconfirmed send is coloured), did the one optional item it had skipped, and added one small gallery improvement. Type-check is clean. The full Jest run had 4 tests time out under machine load, and all of them pass when re-run on their own. Nothing was checked on the emulator.

**Branch:** `g-round5d-privatnost`
**Commits:** `d4a66c82` (the earlier fixer's wip, left as it was) and `e9a82226` (mine, on top). Base is `644cab09`. Nothing was pushed.
**Worktree:** `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN\.claude\worktrees\wf_6f7600b3-c18-4`

**Files changed since the base (21)**
- `src/app/dizajn-privatnost.tsx`
- `__tests__/dizajnPrivatnostGallery.test.tsx`
- `src/data/__tests__/{data-export-screen.test.tsx, export-phase.test.ts, privacy-retention-screen.test.tsx}`
- `src/ui/closure/{ClosureDialog.tsx, ClosurePresentation.tsx, __tests__/ClosureDialog.test.tsx}`
- `src/ui/legal/__tests__/legalScreens.test.tsx`
- `src/ui/privacy/{ExportPresentation.tsx, InlineNote.tsx, PrivacyPresentation.tsx}`
- `src/ui/support/{SupportContextEntry.tsx, SupportController.ts, SupportDetailScreen.tsx, SupportInboxScreen.tsx, SupportNewScreen.tsx, SupportPresentation.tsx, supportCopy.ts (new)}`
- `src/ui/support/__tests__/{SupportContextEntry.test.tsx, SupportScreens.test.tsx}`

My commit touches only six of these: `supportCopy.ts`, `SupportDetailScreen.tsx`, `SupportNewScreen.tsx` (a comment), the gallery, and the gallery and `SupportScreens` tests. All files keep CRLF line endings. I did not edit `SettingsPresentation` or any file I don't own, and added no dependency.

**Results**
- `npx tsc --noEmit -p tsconfig.json`: clean.
- The unit's suites plus every suite that imports a changed module (19 suites): 381/381 pass. `SupportScreens` alone after my changes: 49/49.
- Full `npx jest`: `Test Suites: 4 failed, 292 passed, 296 total` / `Tests: 4 failed, 5622 passed, 5626 total`.
  - All 4 failures were 5 s timeouts under load: `data-export-screen`, `SupportScreens`, `publication-screen`, `my-applications-native`.
  - Re-run alone, together with the two other suites that timed out during the run (`auth-entry-surface`, `pkg011-agreement-workspace`): 6 suites, 244/244 pass.

**Review "tok"**
1. Discard question on Android Back and on "Otvori izvoz i zatvaranje naloga": done (wip). Hardware Back is caught while the screen has focus, the same way Dostupnost does it; both exits ask first when there are typed words.
2. Back from a newly confirmed request no longer lands on an empty form: done (wip). The button now uses `router.replace`.
3. The inbox row shows `time · #number`: done (wip). The comment about "novo" was corrected: news is the orange dot and the word is spoken only. I did not add a visible "novo".
4. Two green primaries when the list fails to load: done (wip). The footer hides in the error state.
5. The closure flow's X is spoken "Zatvori pregled": done (wip). It follows the existing pattern ("Zatvori filtere", "Zatvori javni profil") and is on the owner list below.
6. On Privatnost, "Tvoji podaci" now sits right under "Vidljivost": done (wip).
7. An export copy that cannot be saved shows a stopped last step, using the existing `NOT_AVAILABLE` words: done (wip), with a gallery scene "Kopija nije dostupna".
8. The retry for a failed retention read sits right under its note, and only one refresh shows at a time: done (wip).
9. The grey send button says why during an unconfirmed send: done (wip).
10. A refused send is drawn as failed: done, corrected in my commit. The wip drew every non-confirmed message as danger, including words about a send still waiting to be confirmed. The review's own condition was "danger only when nothing is pending", so a pending send is now drawn as waiting and danger is kept for failures.
11. The reply draft no longer clears when the other side changes the case: done in my commit. Only the person's own confirmed reply clears it, and a stale press still sends nothing (tested).
12. The Dogovor picker rows now show the agreed time as a second line (`vremeTekst`, real data): done (wip).
- Lead item, the `/profil/zatvaranje` route: not done. It needs a line in `src/app/(app)/_layout.tsx`, which belongs to another unit.

**Review "izgled"**
1. Two primaries: done.
2. The export step is spoken "na redu" instead of "u toku": done. The wording is on the owner list.
3. Closure failures use the danger look, and the two "not confirmed yet" messages use the waiting look: done.
4. The closure flow shows its check spinner after returning from the background: done.
5. The grey send button always says why: done. Three reasons reuse words already in the app; "Učitavamo tvoje Dogovore…" is new.
6. The button keeps its words and shows a spinner in both places: done.
7. The composer hint says "Skrati tekst pre slanja." when the text is too long: done.
8. Radio groups for topics and for the decision: done.
9. A failed automatic-deletion read uses the danger note: done.
10. Every off-scale spacing value in the owned files is now on the scale, and the bubble time uses the meta token: done.
11. Gallery: gendered fixture text replaced and the comment about the arrow corrected: done. The support scenes' arrow still does nothing, which the review allowed. In my commit, Android Back in any scene now returns to the list, as in the sibling galleries.

**Review "zastite"**
1. The message preview sheet can no longer leave an invisible layer that blocks touches: done, with a test.
2. The privacy sentence about what is attached is back when opened from a Dogovor message: done, with a test.
3. The decision sheet no longer reopens by itself after a reload: done, with a test.
4. The send spinner shows only for the reply itself: done, with a test.
5. The reply field is limited to 8000 characters: done, with a test.
6. Back asks before discarding typed words, in every state except while a send is running or unconfirmed: done.
7. The missing tests: done. I added one for a draft kept when the other side changes the case, plus tone and gallery Back tests.
8. The "Rokovi čuvanja" header now matches the step 11a group header: done. It is still a copy, because `SettingsPresentation` exports no header component.
- Emulator check of the closure confirmation (a sheet opened over the full-screen flow): not done, no emulator in this run. The gallery scene "Zatvaranje: Pregled spreman" covers it. The check at 320 dp with large text is also still open.

**For the owner to decide (listed, not decided)**
- The spoken label "Zatvori pregled".
- The spoken step state "na redu".
- The new grey-button reason "Učitavamo tvoje Dogovore…".
- Label changes from the original round: the "Izvoz podataka" row, the "Zatvaranje naloga" row, and the legal screen title "Pravila i saglasnosti".
- Everything still open in the original round 5 report.

No legal, privacy or consent text was changed.