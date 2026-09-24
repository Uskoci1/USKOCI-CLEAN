# Round 6 — unit `dogovor-dodaci` (Pitanja i odgovori, izmene Dogovora, deljenje lokacije, grupni Dogovor)

Branch `work/uskoci-r6-dodaci-20260924` (from `work/uskoci-ui-unification-20260924` at `ecb0f13`). No pull request opened.

## Commits

| sha | what |
| --- | --- |
| `7c8f061` | Step 0: read-only audit and spec `docs/implementation/design-system/r6-specs/dogovor-dodaci.spec.json` |
| `f411eae` | Build: four screens split into unchanged logic plus a pure presentation, shared `PillComposer`, photo tray, gallery `dizajn-dodaci` |
| `83a121b` | Fixes from the three-lens review, with a test for each fix |

## Files

New:
- `src/ui/system/PillComposer.tsx`: the floating pill from Poruke, now a shared component.
- `src/ui/qa/TaskQaPresentation.tsx`
- `src/ui/agreements/AgreementActionsPresentation.tsx`
- `src/ui/agreements/AgreementLocationPresentation.tsx`
- `src/ui/groups/GroupConversationPresentation.tsx`
- `src/app/dizajn-dodaci.tsx`
- `src/data/__tests__/dizajn-dodaci.test.tsx`

Changed (all inside the unit):
- `src/ui/qa/TaskQaScreen.tsx`: the render only. The logic above it is byte-identical.
- `src/ui/agreements/AgreementActionsScreen.tsx`: the render, plus the system Back handling for flow steps.
- `src/ui/agreements/AgreementLocationScreen.tsx`: the render only.
- `src/ui/groups/GroupConversationScreen.tsx`:
  - the render;
  - Back now uses `router.back()`; it used to push a new `/dogovor/[id]` on top.
- `src/ui/AgreementPrivateLocation.tsx`: presentation only. The grant, reveal and expiry logic is untouched.
- `src/ui/media/AgreementPhotoComposer.tsx`: presentation only. Every `photos.*` call and every guard is unchanged.
- Their suites:
  - `TaskQaScreen.test`
  - `v5-agreement-actions-screen`
  - `v5-agreement-current-location-screen`
  - `v5-group-conversation-screen`
  - `agreement-private-location`
  - `agreement-photo-composer`

Nothing else changed: no server, migration, Edge function or dependency, and `package.json` is untouched. All files are LF.

## Verification (on `83a121b`)

- `npx tsc --noEmit -p tsconfig.json`: clean.
- The unit's own suites: 19 suites / 374 tests pass.
- Full `npx jest -w 3 --testTimeout=30000`: **Test Suites: 299 passed, 299 total / Tests: 5773 passed, 5773 total**, exit 0. No first-run timeouts.
- For reference, the first full run on `f411eae` was 299 / 5,766.

## Gallery `uskociapp://dizajn-dodaci`

The gallery opens only in an internal build, with the same guard as `dizajn-tabla`. It uses fixture props, and every command does nothing. It draws no photo (no prepared photo carries a receipt) and no profile photo (initials only), and it opens no support.

The test `dizajn-dodaci.test` makes every data service throw on import, opens all 28 scenes, and comes back to the list with "Nazad".

The one outside fetch is map tiles, in the scene "Lokacija · poslednja tačka".

Scenes:
- **Pitanja:**
  - Pitanja · javno
  - Pitanja · moj zadatak
  - Pitanja · odgovaram
  - Pitanja · prazno
  - Pitanja · učitavanje
  - Pitanja · greška
  - Pitanja · ne može da pita
  - Pitanja · provera radnje
- **Izmene:**
  - Izmene · važeći uslovi
  - Izmene · predlog druge strane
  - Izmene · korak 1
  - Izmene · otkazivanje, korak 2
  - Izmene · nepotvrđeno
  - Izmene · potvrđeno
  - Izmene · učitavanje
- **Lokacija:**
  - Lokacija · uskačem
  - Lokacija · tražim
  - Lokacija · poslednja tačka
  - Lokacija · uzimam tačku
  - Lokacija · nepotvrđeno
  - Lokacija · zatvoreno
  - Lokacija · greška
- **Grupa:**
  - Grupa · razgovor
  - Grupa · učesnici
  - Grupa · prazno
  - Grupa · završen
  - Grupa · greška
- **Poruke:**
  - Poruke · fotografije uz poruku

The private location section on the Dogovor's Pregled (`AgreementPrivateLocation`) is not in the gallery, because it reads its grant through `useIzvor`. Check it on the real Dogovor.

## Deviations from the spec, with reasons

1. **The empty-field reason on a grey send is spoken, not drawn.** It is the send's hint ("Upiši pitanje pre slanja."), as in Poruke. Any other reason is drawn above the pill and also spoken: the text is too long, or the task was revised.
2. **No ConfirmSheet on the Dogovor's cancel, refuse or withdraw.** The review step already is the one confirmation for the decision, so a sheet on top would be a third tap.
   - The decisive button is drawn in danger: an outline and danger words.
   - It is not a danger fill. `V2Action` draws a white label only on the brand green, and V2Action is outside the unit.
   - The spec's "danger fill" is proposed as a V2Action change for the lead (see below).
3. **Q&A skip and report sentences reworded.** They now say only what the write does, because the review found that reporting queues no check:
   - "Pitanje se sklanja iz neodgovorenih i ne objavljuje se. Ovo se ne može vratiti."
   - "Pitanje se označava kao prijavljeno i sklanja se iz neodgovorenih. Ovo se ne može vratiti."
4. **Private location duration is said per side.** The spec had one sentence for both sides, but only the requester can revoke.
   - Requester: "Važi dok je ne opozoveš ili dok se Dogovor ne završi."
   - Worker: "Važi dok je druga strana ne opozove ili dok se Dogovor ne završi."
5. **Location fact reworded** to "Prikazuje se samo poslednja podeljena tačka", because it is also shown when no point exists yet.
6. **Group messages offer support on a tap**, and also on a long press or the screen reader's action. Before, a button stood under every message.
7. **The photo row has no height cap.** It is a sideways row now, so the old `maxHeight: 180` would clip the retry.
8. **The Q&A pill does not spin.** While a question is sending, the saved-action panel replaces the pill. A spinner on the pill would therefore only ever show during a refresh.

## Review issues and what happened

`izgled` (visual and accessibility), verdict "fix first":

| # | Issue | Outcome |
| --- | --- | --- |
| 1 | The photo row clips its actions | **Fixed**, with a test |
| 2 | REJECTED showed a check mark | **Fixed**: an info picture instead |
| 3 | Danger fill | **Partly fixed.** The outline is kept and the edge goes quiet while resting disabled. A fill needs a change to V2Action (outside the unit). |
| 4 | The bubble role was wrong | **Fixed**: "text" when there is no support path; a tap and an accessibility action when there is |
| 5 | Grey send had no reason | **Fixed** |
| 6 | Raw spacing values | **Skipped.** The 13/14/10 values match AgreementChat's pill and bubble measures, which the two surfaces share. Changing them belongs with moving AgreementChat onto PillComposer. |
| 7 | "expanded" state on the people toggle | **Skipped.** `ChromeIconButton` has no `expanded` prop and is outside the unit. Proposed below. |
| 8 | "Proveri ishod" looked disabled | **Fixed**: green while enabled |

`tok` (flow and UX), verdict "fix first":

| # | Issue | Outcome |
| --- | --- | --- |
| 1 | Support reachable only by a long press | **Fixed** |
| 2 | The report sentence promised a check | **Fixed** |
| 3 | The worker was told they could revoke | **Fixed**, with a test |
| 4 | REJECTED looked like success | **Fixed** |
| 5 | Android Back skipped flow steps | **Fixed**: Back closes the step like the X, and waits while a command runs. Test added. |
| 6 | Pill spinner | **Skipped**, see deviation 8 |
| 7 | Location fact wording | **Fixed** |
| 8 | "Razgovor je završen" was said twice | **Fixed** |
| 9 | Photo tools disabled without a reason | **Partly fixed.** At six photos the reason is now said. For `!photos.available` the controller supplies no reason and none was invented. The permission case keeps its PermissionRecovery. |

`zastite` (correctness), verdict "fix first". It confirmed that every guard, journal, idempotency key, recovery path, read marking and binding word is unchanged.

| # | Issue | Outcome |
| --- | --- | --- |
| 1 | Photo row clipping | **Fixed** |
| 2 | Support behind a gesture | **Fixed** |
| 3 | Worker sentence | **Fixed** |
| 4 | Test for a skip confirmed after a refresh | **Added**. It proves that nothing is written. |
| 5 | `mockCanGoBack` leak between tests | **Fixed**: reset in `beforeEach` |

Optional tests it named, both **added**:
- the last point stays on screen while a new one is being taken;
- after a failed refresh with terms on screen, the refresh stays offered in the bar.

## Proposed for the lead (outside this unit)

- Move `AgreementChat`'s private pill and bubble measures onto `src/ui/system/PillComposer.tsx`, and give Poruke the same tap-to-support path the group conversation now has. Poruke is still long-press only.
- `V2Action`: a danger-filled variant with a white label, when the lead wants the spec's "danger fill".
- `ChromeIconButton`: an `expanded` state for toggles that open a panel. The people button in the group conversation is spoken as "selected" today.

## Owner decisions left open

- **Group messages carry no per-message delivery or read state.** The read does not return one, so none is drawn.
- **The two new Q&A confirmation sentences** (deviation 3) are open to the owner's wording.
- **Location sharing has no duration.** The last shared point stays visible to the other side of an active Dogovor. Whether an old point should expire from view is a privacy decision, and it needs a server change.

## What the emulator check should look at

1. `dizajn-dodaci`, every scene at 320 and 430 dp and at font scale 1.3. In particular:
   - the pill with the "Odgovor na" line;
   - the Izmene fact rows and their "umesto" lines;
   - the photo row with a photo still on its way;
   - the group bubbles.
2. The real Q&A screen from a task: ask, answer, skip and report through the sheet. The pill should stay above the keyboard.
3. On a real Dogovor:
   - the form and review steps of Izmene i otkazivanje, and that Android Back closes a step;
   - Trenutna lokacija for both sides;
   - the Pregled section "Lokacija i pristup" for both sides, including the duration line;
   - the group conversation's Back returning to the Dogovor, not a second copy of it.
