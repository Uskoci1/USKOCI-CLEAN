**Branch** `g-round5d-obavestenja`. It is not pushed.
**Worktree** `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN\.claude\worktrees\wf_6f7600b3-c18-3`

**Commits** (base `644cab09`)
- `4075a362`: the earlier fixer's wip commit. I read all of it, kept it as it is and did not rewrite it.
- `dd9998b4`: my finishing commit.

**Files changed since 644cab09** (18 files, 482 insertions, 89 deletions)
- Screens and routes: `src/app/obavestenja.tsx`, `src/app/(app)/profil/obavestenja.tsx`, `src/app/(app)/profil/blokirani.tsx`, `src/app/(app)/profil/o-aplikaciji.tsx`, `src/app/(app)/bezbednost.tsx`, `src/app/dizajn-obavestenja.tsx`
- Components: `src/ui/notifications/InboxPresentation.tsx`, `src/ui/notifications/PushPreferences.tsx`, `src/ui/settings/BlockedAccountsList.tsx`, `src/ui/settings/SettingsPresentation.tsx`
- Tests: `about-screen`, `blocked-accounts-screen`, `dizajn-obavestenja-gallery`, `inbox-native`, `pkg011-slice6-presentation`, `push-preferences-native`, `push-settings-route`, `safety-route-guard`
- All are CRLF, checked with `file`.

**What my commit adds to the wip**
- **Settings set from the inbox (flow review item 11):** the inbox gear now opens settings on the set the list is filtered to, with the param `skup=REQUESTER|WORKER`. The settings route shows that set each time it gets focus and ignores any other value. "Sve" still pushes the plain `'/profil/obavestenja'` literal.
- **Fixed a regression in the wip:** its blocked-list `empty` check removed "Početak liste" from an empty later page whenever another page followed. Now only an empty first page that has more pages after it stops saying "Još nema blokiranih korisnika.".
- Tests for both.

**Results**
- `npx tsc --noEmit -p tsconfig.json`: exit 0.
- The 8 changed suites run one after another: 8/8 suites, 109 tests, plus 3 new tests after my edits. All pass.
- Full `npx jest`: `Test Suites: 2 failed, 294 passed, 296 total` / `Tests: 2 failed, 5626 passed, 5628 total`.
  - Both failures were 5 s timeouts under load: `retired-discovery-routes` and `data-export-screen`. Neither is on the allowed list.
  - Re-run alone, both pass (2 suites, 48 tests).

**Flow review ("tok")**
1. Dead "Odblokiraj": done. The list is locked while it shows an error, and a test covers it.
2. Back while saving: done. The route is only told about unsaved changes when nothing is saving, and the set tabs wait while a write runs.
3. The phone section contradicts itself: done. "Isključi" is hidden on UNSUPPORTED and UNCONFIGURED devices, and the lines now name the set. The wording is for the owner.
4. A confirmed save looks like success: done. The grey-button reason is gone after a save and "Podešavanja su sačuvana." appears as a live region. The wording is for the owner.
5. "Poveži ovaj telefon" when sending is on but this phone is not connected: done.
6. "Osveži obaveštenja" on the "Radnja nije potvrđena." banner: done.
7. "Osveži stanje" only when there is no error: done.
8. "Nastavi uređivanje" as the cancel label: done. It is already used on Dostupnost.
9. The category note sits under the first group: done.
10. Chevron in the person row: done. The question-style sheet title is not done: it is owner wording, and Serbian name declension would be needed.
11. Plain "Nazad" and passing the set: done. Where Back lands on the emulator is not verified, because no emulator was used.
12. Gallery test timeout: done (60 s).
13. Separate empty state for your own account: done ("Ovo je tvoj nalog"). The wording is for the owner.

**Look review ("izgled")**
1. Saved state and gallery scene "Podešavanja · sačuvano": done.
2. Flaky gallery test: done.
3. Only one refresh button, and a reason on the first waiting phone button ("Prvo proveri stanje." or the save-first line): done.
4. The double 0.55 fade: removed, done.
5. Rows animating that did not arrive: done. Each filter keys its own list, and only events newer than the newest one on screen animate.
6. A disabled row's FactArt is drawn muted: done.
7. Note moved to the first group: done.
8. Spacing on the other settings screens and `privatnost.tsx:77`: not done. That file is outside my list, and there are no emulator screenshots.
9. O aplikaciji heading: done.
10. "Poslednja provera slanja" as a heading: done.
11. 4/8 spacing in `InboxPresentation`: done.
12. Double bottom inset in the gallery: not done, because it is not a defect on Android. The native `SafeAreaView` only applies the part of the inset its own frame overlaps (`getSafeAreaInsets` in `SafeAreaUtils.kt`), and the scene's `SettingsScreen` ends above the strip.
13. Clock instead of calendar icon in the time fields: not done. `CalendarControls` belongs to step 10.
14. Orange icons in inbox rows, or a muted `NEED_CANCELLED` row: left to the owner.

**Protections review ("zastite")**
1. Phone status: done. An unconnected phone says so first, and the set is named. The wording is for the owner.
2. Spinner on the wrong button: done. `run` now takes the command kind, and the foreground listener also checks `scope.busy`.
3. A confirmed unblock reported as unconfirmed: done. If the re-read fails, the page shown stays without that person, and the success notice appears.
4. Unsaved question during a save: done.
5. Screen reader after a save: done.
6. Zone tests: done. The case "phone zone unknown and stored zone empty" cannot be reached: `notificationPreferencesClientService.read` refuses an empty zone, and a draft only takes a known phone zone.
7. Info items: not done, all outside my files. `scripts/n04_android_inbox_journey.py` still taps the old label, `src/ui/v2/spojInboxArt.ts` is dead code, and none of the settings screens has been screenshotted.

Also, as both "tok" and "zastite" noted: the automatic re-read when the app returns to the foreground is a change from the spec. It is read-only and never runs over unsaved changes.

**Owner wording to approve**
- "Podešavanja su sačuvana."
- "Poveži ovaj telefon"
- "Osveži obaveštenja"
- "Ovaj telefon još nije povezan"
- "Slanje na telefon je uključeno / isključeno za Moje zadatke / Moje prijave."
- "Obaveštenja na telefon su uključena / isključena za …"
- "Ovo je tvoj nalog" and its body line
- A question-style title for the unblock sheet
- Still open from the report: names in notifications, the "Oporavak" and "Nalog i ostalo" switches, the `BuildIdentity` wording, and the "Povezan telefon…" line that repeats "Ovo je stanje sistema…"