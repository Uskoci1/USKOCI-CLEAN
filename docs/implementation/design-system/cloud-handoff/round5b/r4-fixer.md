All remaining must-fix and should-fix items in the four verifier reports are now in the code. Types are clean, and the full Jest run passes once two slow tests are re-run on their own. Nothing is pushed, and no emulator check was run.

**Branch and commits**
- Branch `g-round5c-r4` already existed from an earlier run of this same task. It held commit 4fa6a58d on top of 644cab09, with most of the fixes. I checked that work against every verifier item and built on it instead of recreating the branch.
- 4fa6a58df57346f072a8100fa207c0c504384b49: the earlier run's round-4 verifier fixes.
- d1896db9b78b45ff490630afa6ad8fc1bad01787: new in this run. Poruke now says what the Dogovor waits for from me.
- Worktree: `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN\.claude\worktrees\wf_6f7600b3-c18-5`. The `node_modules` junction and the gitignored `entryReferenceData.ts` are present but not committed.

**Files changed**
- 4fa6a58d:
  - `src/app/(app)/moje-prijave.tsx`, `src/app/(app)/profil/razgovor.tsx`
  - `src/app/dizajn-dogovori.tsx`, `src/app/dizajn-prijave.tsx`
  - `src/ui/AgreementChat.tsx`, `src/ui/aiFirst/VoiceComposer.tsx`
  - `src/ui/v2/AgreementCollectionPresentation.tsx`, `ApplicationFace.tsx`, `ApplicationSelectionPresentation.tsx`, `CandidateFace.tsx`, `IntakePresentation.tsx`, `MyApplicationsPresentation.tsx`
  - tests: `agreement-chat-ui`, `agreement-collection-presentation`, `ai-conversation-layout`, `application-face`, `pkg011-slice3-presentation`, `voice-composer-controls`, `worker-ai-conversation-recovery`
- d1896db9:
  - `src/ui/agreements/AgreementWorkspace.tsx`, `src/ui/v2/AgreementPresentation.tsx`, `src/app/dogovor/[id].tsx`, `src/app/dizajn-dogovori.tsx`
  - test: `src/data/__tests__/pkg011-agreement-workspace.test.tsx`
- Line endings are unchanged; files that were CRLF stay CRLF, with no mixed lines.

**Results**
- `npx tsc --noEmit -p tsconfig.json`: exit 0.
- `pkg011-agreement-workspace`: 47 of 47 pass, including 7 new tests.
- Full `npx jest --silent`: Test Suites 2 failed, 294 passed, 296 total; Tests 2 failed, 5615 passed, 5617 total.
  - Both failures were the 5 s first-run timeout, in `my-applications-native` and `SupportScreens`.
  - Re-run alone, both suites pass: 2 suites, 86 of 86 tests.
  - `SupportScreens` is not on your list of known slow suites, but it failed the same way, by timeout rather than an assertion.

**Moje prijave (verify4b-rp)**
- **A, done (4fa6a58d):** a chosen offer no longer says "Dolazi 1 osoba". `offerSettled` now also covers SELECTED; tests updated with comments.
- **B, done (4fa6a58d):** a failed read now says "Prijave nisu učitane. Pokušaj ponovo za trenutak." in the route and in the gallery.
- **Nits, done (4fa6a58d):** "prijave" is lower-case mid-sentence in three messages, and the retry comment and test name now say a command is in flight, not a read.
- **C, not done:** the emulator photos at 320/360/390/430 px and large text. This task has no emulator step.
- **D, not done:** the unused `danger` foot tone in `TaskFace.tsx`, and a way for a disabled StateView action to give its reason in `StateView.tsx`. Neither file is mine, and the disabled state cannot be reached today.

**AI conversation (verify4b-ra)**
- **A, done (4fa6a58d):** the worker thread no longer shows a saved message a second time as "šalje se". Test added.
- **B, done (4fa6a58d):** a Switch Access or Voice Access click on the held microphone now shows the hold advice and "Govori bez držanja". Tests added.
- **Optional hardening, done (4fa6a58d):** voice mode now closes after a reviewed capture based on the controller's session, not on render timing.
- **C, done (4fa6a58d):** the draft card's ready line uses the `note` type token.

**Candidates (verify4b-rk)**
- **Nit 3, done (4fa6a58d):** the unused `nameShown` branch and its style are removed, and the comments are fixed.
- **1, not done:** the emulator check of the offer sheet (name as title, the ×, the still success mark, the confirmation over the sheet). Whether the profile row needs a visible "Pogledaj profil" line depends on those photos.
- **2, not done on purpose:** the extra white space in compare mode. The suggested fix lines the cells up from the bottom. When the two "Termin" cells wrap to different lengths, the "Ukupno" and "Ljudi" cells would then slip apart, which is the misalignment the earlier fix removed. This should be judged on the emulator photos.
- **4, not done:** `scripts/ru5_android_device_ui_journey.py` and `scripts/test_ru5_android_input.py` still tap old labels. These files are not mine.
- **5, needs your decision:** the offer sheet's "Sposobnosti" section shows the applicant's self-declared skills to the requester. Check it against the rule that no skill is shown as a label to other people.
- **6, not done:** the × scrolls away on a long offer message. The fix belongs in `ProductSheet.tsx`, which is not mine.

**Dogovori and Poruke (verify4b-rd)**
- **Items 2, 3, 4, 6 and 7, done (4fa6a58d):**
  - a message with text and photos is heard with both;
  - the gallery scenes now match the route;
  - "Osveži poruke" is offered in an empty thread and not on a closed Dogovor, an error or the first loading spinner;
  - the disabled photo control's hint says what holds its panel open;
  - the Dogovor card's waiting foot uses the shared `ownerFoot` style.
- **Optional "Poruke no longer says when a Dogovor waits for me", done (d1896db9):**
  - The summary above Poruke now shows, as its second line with the orange dot, what waits for me. It uses the step card's words ("Predlog izmene čeka tvoj odgovor", "Završetak je označen i čeka tvoju potvrdu") or "Čeka tvoju ocenu".
  - That line takes the place of the price line; the terms are one press away. The spoken label gains the same words and stays unchanged when nothing waits.
  - Nothing is shown when the Dogovor waits for the other side, or when the rating read did not answer.
  - The gallery mirrors this and has a new scene, "Poruke · čeka te".
- **Item 1 leftover, not done:** in `src/app/(app)/oceni-dogovor.tsx` (about line 20), the fallback when the id or session is missing always says "Nazad na Dogovore". That file is not mine. The fix is to pick the label the same way as line 24 (Početnu / Dogovore / Dogovor) and use `fromHome ? backFromReviewToHome : backFromReview`.

No guard, server call, recovery, revision, idempotency, consent, read or viewed marking changed, and no dependency was added.