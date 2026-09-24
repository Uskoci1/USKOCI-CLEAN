**Verdict: fix first.** One small regression needs fixing: switching the inbox filter now rebuilds the whole list. Everything else the fixer claims holds up in the code. Guards, idempotency and legal wording are unchanged, the tests were not weakened, `tsc` exits 0 and the related suites pass.

Reviewed read-only: branch `g-round5d-obavestenja`, commits `4075a362` and `dd9998b4` on base `644cab09`, in `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN\.claude\worktrees\wf_6f7600b3-c18-3`. The worktree is clean.

## Remaining issues, most severe first

**1. Low-medium, fix first. Changing the inbox filter rebuilds the whole list, filter tabs included.**
- **Where:** `src/app/obavestenja.tsx:68` and `src/app/dizajn-obavestenja.tsx:155` (`<InboxList key={role ?? 'ALL'} …>`).
- **Why it matters:** the filter tabs are inside that list's header (`InboxPresentation.tsx:190-192`). A new key throws away the tab the person just pressed. A TalkBack user therefore loses focus on every filter switch and has to swipe back from the top bar. This follows from how the key works; I did not check it on a device.
- **Fix:**
  - Remove both `key` props.
  - Reset the arrival tracking inside `useArrivals` (`InboxPresentation.tsx:156`) instead. It can't reuse `useAppear`, whose `settled` flag cannot be reset. Keep a ref `{ list, settled, seen: Set<string>, newest }`. When `list` differs from the value passed in, start it over with `settled: false`, an empty set and `newest: null`. Settle on the first non-empty `items`, keep the existing newest-only logic, and return `{ isNew }`.
  - Call it as `useArrivals(items ?? [], role ?? 'ALL')`.
  - This is safe: `useInbox` builds a new model for each filter in the same render, so the first render after a switch has an empty page and the reset lands before that filter's first page.
  - Keep the test in `inbox-native` that a filter's first page does not animate. Add a check that the tab control is still the same instance after a switch.

**2. Low, not blocking. After a confirmed unblock, a failed re-read is covered by the old page in every case** (`src/app/(app)/profil/blokirani.tsx:55-62`).
- The fallback also runs when the server refuses the re-read (`{ok:false}` with any code), not only when there is no answer. That goes against the rule in `useOwnedEditor.ts:45-47` that a refusal leaves nothing on screen worth believing.
- It is safe:
  - An account change is still stopped by `scope.current()`.
  - Each row keeps its own revision, which the server checks on the next command.
  - The test covers both cases on purpose, and the zastite review asked for exactly this.
- Record it as a known trade-off. No change needed.

**3. Info. On error, the same sentence is announced twice.**
- `PushPreferences.tsx:242` and `:245`: after "Stanje nije potvrđeno…" appears, TalkBack hears "Prvo proveri stanje." twice, from Save and from the first phone button, because `V2Action.tsx:111-117` announces every new reason.
- The izgled review asked for the phone-button reason. Accept it or tune it later.

**4. Info. The set tabs look active while they are locked.**
- `src/app/(app)/profil/obavestenja.tsx:72` locks the tabs during a write with `pointerEvents="none"`, and `requestRole` also returns early.
- Nothing looks disabled, though. `Segmented` has no `disabled` prop, and that file is outside this unit.

**5. Info, owner decision. No way to switch the phone off on these devices.**
- On an `UNSUPPORTED` or `UNCONFIGURED` device with sending on, the text says "Slanje na telefon je uključeno za …". No control turns it off from this device (`PushPreferences.tsx:233-238`).
- This follows the spec and the tok review; the owner should know.

**6. Info. The settings screen reopens on the last set.**
- It stays mounted, and a plain push replaces its params. The tab router copies params only with `merge`.
- So opening from Profil after an inbox visit filtered to "Moje prijave" shows "Moje prijave" (`profil/obavestenja.tsx:24-29`). This matches the old behaviour, where the last choice persisted.

**7. Info. Scope and what is still unchecked.**
- `src/ui/settings/BlockedAccountsList.tsx` is not in the literal file list. It is the unit's own file from `0bb50124`, imported only by `blokirani.tsx` and the gallery.
- No emulator screenshots were taken of:
  - the 4/8 spacing in `InboxPresentation.tsx:258,263`;
  - the person-row chevron (`SettingsPresentation.tsx:144`);
  - the muted icon on disabled rows (`:91`).

## Each review item checked in the code

**Flow review ("tok"), all done except 10b:**

| # | Status | Where |
|---|---|---|
| 1 | done | `BlockedAccountsList.tsx:33` (`!!error` added to `locked`), with a test |
| 2 | done | `PushPreferences.tsx:164-167`, route `:56,72` |
| 3 | done | `PushPreferences.tsx:233-238, 342-352` |
| 4 | done | `PushPreferences.tsx:245, 330` |
| 5 | done | `PushPreferences.tsx:236` |
| 6 | done | `InboxPresentation.tsx:187` |
| 7 | done | `PushPreferences.tsx:240` |
| 8 | done | `profil/obavestenja.tsx:52-53` (`ConfirmSheet` supports `cancelLabel`) |
| 9 | done | `PushPreferences.tsx:276` |
| 10a (chevron) | done | `SettingsPresentation.tsx:144` |
| 10b (question-style sheet title) | not done | owner wording |
| 11 | done | `profil/obavestenja.tsx:70` (default `backLabel` is "Nazad"), `:24-29`; `obavestenja.tsx:25-26` |
| 12 | done | gallery test, 60 s |
| 13 | done | `bezbednost.tsx:13,19`; the guard is equivalent to before |

**Look review ("izgled"):**
- **Done (1-7, 9-11):**
  - 1, 2, 7, 10 and 11 at the lines above.
  - 3: `PushPreferences.tsx:240-242`.
  - 4: the double fade is gone, with a test.
  - 5: `useArrivals` is correct, but see issue 1.
  - 6: `SettingsPresentation.tsx:91`.
  - 9: `o-aplikaciji.tsx:25`.
- **Not done:**
  - 8: outside the file list.
  - 12: the fixer's reasoning about the native safe-area inset holds.
  - 13: step 10's file.
  - 14: left to the owner.

**Protections review ("zastite"):**
- **Done (1-6):**
  - 2: `run(…, kind)`, `:76-84`, and `scope.busy` in the foreground listener, `:107`.
  - 3: `blokirani.tsx:55-62`.
  - 6: zone tests. The "unreachable" claim is true: the read refuses an empty zone (`notificationPreferencesClientService.ts:33`).
- **Not done (7):** all three leftovers are confirmed, and all are outside the file list:
  - `scripts/n04_android_inbox_journey.py:51,52,85` still uses "Pročitaj sve".
  - `src/ui/v2/spojInboxArt.ts` has no importer.
  - No settings screen has been screenshotted.

## Protections, words and tests

- **Unchanged:**
  - Unblock still uses the same revision and a reused request id.
  - The route literals the control table checks, `open()`, read marking, closure, export and support are all unchanged.
  - The `PRIVACY` sentence, the unblock sentence and the category note keep their words; the note only moved.
  - No `package.json` change.
- **Tests:**
  - No test lost its intent. Old-look pins were updated with comments: the "Nazad" label, "Osveži obaveštenja", and the own-id case split into its own test that still asserts no `Safety` screen renders.
  - **Line endings:** all 18 files are CRLF on every line.

## What I ran in the fixer's worktree

- `npx tsc --noEmit -p tsconfig.json`: exit 0.
- `jest --findRelatedTests` on the changed source files gave 36 suites, which covers every consumer of `SettingsPresentation`. With 3 workers: 35 passed, 1 failed, 685 of 686 tests passing.
  - The failure was `SupportScreens` hitting the 5 s timeout. That suite mocks `SettingsPresentation` entirely, so this branch cannot cause it.
  - Re-run alone on this branch it passed, 37 of 37. The same single test also passes on the base in my worktree.
  - The machine had about 37 node processes running.