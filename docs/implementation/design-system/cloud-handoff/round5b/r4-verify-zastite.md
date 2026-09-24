**Verdict: ship.** The code does everything the fixer claimed. I found no regression, no weakened test, no file outside the unit and no change to any guard or protected path. What is still open is outside this unit's code: the emulator loop, one file the fixer does not own, and one owner decision.

**Checks I ran** (read-only, fixer worktree `wf_6f7600b3-c18-5`, HEAD d1896db9, clean tree, not pushed)
- **Types:** `npx tsc --noEmit -p tsconfig.json` exits 0.
- **Jest:** I ran 36 suites, 877 tests: everything `--findRelatedTests` returns for the 15 changed source files, plus every suite that names a changed module.
  - On a cold cache, 4 suites failed by the 5 s timeout only. Re-run warm, all passed.
  - Under the same load, the base commit took 40 s for `agreement-review-navigation` and the branch took 19 s warm, so these are machine timeouts, not regressions. I found no assertion failure.
- **Line endings:** all 23 files are LF at both 644cab09 and d1896db9, with no mixed lines. The fixer's "CRLF stays CRLF" is inaccurate but harmless.
- **Scope:** every changed file is in the owned list. `projections.ts`, `agreementClientService.ts` and `package.json` are untouched.
- **Protected paths:** no guard, server call, recovery, revision, idempotency, consent, closure, export, support, read marking or viewed marking changed. No legal, privacy or voice-notice text changed.
- **Tests:** four updated assertions each pinned the old look and carry a comment: SELECTED "Dolaze", the white foot, the empty-thread refresh, and one test name. Every new test fails on the old code.

**Item by item**

*Moje prijave (rp)*
- **A, done.** `ApplicationFace.tsx:92` `offerSettled` includes SELECTED. It is used in the spoken summary, `OfferRow` and the summary. Nothing else still uses `applicationOver`.
- **B, done.** `moje-prijave.tsx:116` and `dizajn-prijave.tsx:89`.
- **Nits, done.** `moje-prijave.tsx:104,204,205`; the comment at `MyApplicationsPresentation.tsx:111-112`; the test name at `pkg011-slice3-presentation.test.tsx:104`.
- **C and D, not done.** C needs the emulator, and D is in `TaskFace.tsx` and `StateView.tsx`, which the fixer does not own. Both are correctly listed as open.

*AI conversation (ra)*
- **A, done.** `profil/razgovor.tsx:222-223,234`. Voice mode stays right: `said` falls back to the last USER message and `answer` stays null (`AiConversationShell.tsx:95-96`).
- **B, done.** `VoiceComposer.tsx:102-103`, on an RN `Pressable`, which passes the props through. The only caller passes `onTooShort` (`AiConversationShell.tsx:171`). A disabled microphone ignores the action, and a screen reader gets no action.
- **Session hardening, done.** `VoiceComposer.tsx:196`. The IDLE-transition guard is kept. `finish()` keeps the session and `cancel()` blanks it (`holdToTalk.ts:303-311`). Failures carry `error`, so they are excluded.
- **C, done.** `IntakePresentation.tsx:269`.

*Candidates (rk)*
- **Nit 3, done.** `CandidateFace.tsx:223-241`; `ApplicationSelectionPresentation.tsx:410,481`. Nothing is left that uses `nameShown`.
- **Item 2, deferring it is right.** The cell order is Ukupno, Ljudi, Termin (`CandidateFace.tsx:212-217`). If the cells were anchored to the bottom, a Termin that wraps would shift Ukupno and Ljudi.
- **Items 1, 4, 5 and 6 are open.** They need the emulator, non-owned files or an owner decision.

*Dogovori and Poruke (rd)*
- **Item 2, done.** `AgreementChat.tsx:69`.
- **Item 3, done.** The gallery fixture ids `izmena` and `grupa` match `PROPOSALS`. The copy matches `dogovor/[id].tsx:355-410`.
- **Item 4, done.** `AgreementChat.tsx:167`.
- **Item 6, done.** `AgreementChat.tsx:143-146`. The version-conflict hint matches what `AgreementPhotoComposer.tsx:18` tells the person.
- **Item 7, done.** `AgreementCollectionPresentation.tsx:315`. The lower corners are nested in the card's corner.
- **Optional waiting line, done.** `AgreementWorkspace.tsx:80-88`, `AgreementPresentation.tsx:117-128` and `[id].tsx:296-300,348`. It matches the step card, including `me` and `requester` from `[id].tsx:197-198`. It shows nothing for UNKNOWN or for my own proposal. The mock reset in `beforeEach` keeps the 7 new tests isolated.
- **Item 1 leftover, not done.** It is in a file the fixer does not own (see issue 2).

**Remaining issues, most severe first**
1. **Emulator loop not run. The owner's rule is that no screen is done before it.**
   - `/dizajn-prijave` (Lista, Dugi nazivi, Veliki) at 320, 360, 390 and 430 px and with large text.
   - `/dizajn-kandidati`: the offer sheet (name as title, the ×, the nameless profile row), "Dogovor sklopljen", and a confirmation over the sheet.
   - The new "Poruke · čeka te" scene. `AgreementPresentation.tsx:126` has `numberOfLines={2}`, and "Završetak je označen i čeka tvoju potvrdu" could be cut off at 320 px and text scale 1.3. If it is, drop `numberOfLines` or use 3; the full words are already in the spoken label.
2. **Not the fixer's file (`src/app/(app)/oceni-dogovor.tsx:20`).** The fallback button always says "Nazad na Dogovore" and always calls `backFromReview`. Fix:
   ```tsx
   <V2Action label={fromHome ? 'Nazad na Početnu' : fromList ? 'Nazad na Dogovore' : 'Nazad na Dogovor'}
     onPress={fromHome ? backFromReviewToHome : backFromReview} />
   ```
3. **Owner decision.** The "Sposobnosti" section (`ApplicationSelectionPresentation.tsx:495`) shows the applicant's self-declared skills to the requester. Check it against the rule that no skill is shown as a label to other people.
4. **Not the fixer's files:**
   - the × scrolls away on a long offer (`ProductSheet.tsx:136-144`; pin the title above `BottomSheetScrollView`);
   - stale labels in `scripts/ru5_android_device_ui_journey.py:805` and `scripts/test_ru5_android_input.py:390`;
   - the unused `danger` foot tone in `TaskFace.tsx`;
   - a disabled `StateView` action cannot give its reason (`StateView.tsx:9-11`).
5. **Nit, in the unit and older than this round: a gendered form.** `dogovor/[id].tsx:401` says "Nisu podelili svoj broj" (masculine plural), and the gallery now repeats it at `dizajn-dogovori.tsx:193`. Suggested words: `'nije podeljen'`, giving "Broj druge strane: nije podeljen".
6. **Nit, in the unit: capital "Prijava" mid-sentence.** Still at `moje-prijave.tsx:31` (twice, "Ova Prijava"), `:35` ("aktuelnu Prijavu") and `MyApplicationsPresentation.tsx:88` ("u Prijavi"). Lower-case them like the three already fixed, unless "Prijava" is meant to be a capitalised term like "Dogovor".
7. **Nit, test gap.** No test pins the case where a reviewed capture goes from LISTENING straight to IDLE with its session kept and voice mode closes (`VoiceComposer.tsx:196`). The existing positive test passes through FINALIZING. Add one update of `{...idle, session: reviewed}` directly after LISTENING, and expect `onClose('review')`.