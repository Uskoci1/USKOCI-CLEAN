**Verdict: fix first.** Most review items really are fixed. But the new keyboard handling added in `21d7448d` creates a dead tap, and two of the photo fixes clash with each other. Also, no screen in this unit has been through the emulator loop yet.

**What I checked (read-only, `wf_6f7600b3-c18-1` at `21d7448d`):**
- I re-ran the 9 changed suites in band: 9 suites and 126 tests pass.
- These fixes are confirmed in the code:
  - the invented status and its test;
  - the photo pick error now stays in pick mode, and its test shows the gallery works without a read in between;
  - the area saved line sits in the footer;
  - area and name saves wait during a re-read, and a failed re-read offers the retry;
  - the support sentence, the stepper and the "Spremno za aktivaciju" gate;
  - the hub "Nije podešeno" row and the long-name stacking;
  - the `ReputationLine` guard, tested directly;
  - the gallery client counter, the spacing tokens, the PickerTile type from the scale, and the accessible unavailable circle;
  - the rule date's year and the licence word.
- Only one filled button on the denied-camera screen is true: `PermissionRecovery` uses V2Action's default `secondary` (white).

**Issues, most severe first**

1. **Medium. Some taps now do nothing while the keyboard is up. This comes from `21d7448d`.**
   - **Where:** `src/ui/workerProfile/WorkerProfilePresentation.tsx:40-41` hides the whole footer while the keyboard is up. `src/app/(app)/profil/radnik.tsx:125` (`navigate`) and `:162` (`openConversation`) put their refusal in that footer (`WorkerProfileFooter error={validation…}`).
   - **What happens:** the person edits a field, so the draft is changed and the keyboard is up. They scroll and tap "Područje rada", "Dostupnost", "Uredi profil kroz razgovor" or the suspended "Piši podršci". The ScrollView has `keyboardShouldPersistTaps="handled"`, so the keyboard stays up. The refusal is written into a footer nobody can see, and on screen nothing happens. Jest can't catch this, because the hidden footer is still in the tree.
   - **Also:** `guide()` (radnik.tsx:129-133) sets its reason and then focuses a field, so "Pre aktivacije unesi ime…" disappears the moment the keyboard opens.
   - **Fix:**
     - Import `Keyboard` in radnik.tsx.
     - At :125 write `Keyboard.dismiss(); setValidation(path === '/podrska' ? … : …); return;`.
     - At :162 write `Keyboard.dismiss(); setValidation('Sačuvaj unos pre otvaranja razgovora.'); return;`.
     - For `guide()`, check on the emulator that the body checklist is enough. If it is not, keep `WorkerProfileFooter`'s message and error lines visible while typing and hide only its buttons and the `held` line.
     - Add a test that fires keyboard show, taps a row with a changed draft, and expects `Keyboard.dismiss` to be called.

2. **Medium-low. The photo recovery label now contradicts the error right above it.**
   - **Where:** `src/ui/profile/ProfilePhotoPresentation.tsx:57`, used at `:77`.
   - **Why:** tok fix #1 moved every pick refusal (camera, size, preparation) into `pick` mode. So `reconcile` is only reached when a read really is needed. These cases now show "Nazad na izbor fotografije" next to an error that asks for a check:
     - a failed storage write: "Čuvanje nije potvrđeno. Proveri sačuvano stanje pre novog pokušaja." (useOwnedEditor.ts:104);
     - a failed read after a confirmed apply, clear or discard (`finishCommand`, fotografija.tsx:99-104): "…Proveri ishod.";
     - a read after a version conflict.
   - The izgled review asked for this label only because of the pick refusals, and those no longer land here.
   - **Fix:** drop `checkLabel` and use `label="Proveri sačuvanu fotografiju"` at :77. Change the test at `src/data/__tests__/v5-avatar-screen.test.tsx:144-151` to press "Proveri sačuvanu fotografiju" (keep the read-count assertion). Remove or relabel the gallery scene `photo-back` (`src/app/dizajn-profil.tsx:209`).

3. **Medium-low. While a photo retry sends, its button is swapped for a grey one with no reason.**
   - **Where:** `src/app/(app)/profil/fotografija.tsx:192`, together with `:93` and `:107`.
   - **What happens:** retrying an unconfirmed upload calls `upload()`, and `persist()` resets `readAttempted.current = false`. The new `setSending(true)` then re-renders while the upload is in flight, and `retryable` turns false.
   - For the whole upload, the pressed "Ponovi istu promenu" and its spinner disappear. In their place: "Slanje ili promena još nisu potvrđeni. Proveri ishod pre novog izbora." and a grey filled "Proveri sačuvanu fotografiju" with no reason, under "Šaljemo fotografiju…". This is the same class as izgled #4, on the retry path.
   - **Fix:** `retryable={running === 'RETRY' || (!trouble && !!intent.current && readAttempted.current && (intent.current.phase !== 'UPLOAD' || !!bytes.current))}`. This is display only; `retry()` and `editor.save` keep every guard. Add a test: unresolved UPLOAD with bytes → press retry with a pending upload → "Ponovi istu promenu" still shows `loading` and there is no "Proveri ishod pre novog izbora".

4. **Low. The capacity note keys on status, not on whether a profile exists.**
   - **Where:** `src/ui/workerProfile/WorkerProfilePresentation.tsx:250`, `saved={status !== null}`.
   - **What happens:** a saved profile whose state is unknown (`stanje: null`, e.g. CLOSED) says "Sačuvaj profil da bi se broj ljudi potvrdio." while the primary reads "Osveži radni profil".
   - **Fix:** add a `profileExists` prop to `WorkerProfileForm`, pass `profileExists={profile !== null}` from radnik.tsx:177, and use it for `saved`.

5. **Low. A long name can still be cut with an ellipsis.**
   - **Where:** `src/ui/profile/ProfileHubPresentation.tsx:48-50`.
   - **What happens:** the stacked name stops at 3 lines. At 320 dp and font scale 1.3, a name longer than about 42 characters still ends in "…". The 24-letter threshold also ignores text scales 1.1–1.29.
   - **Fix:** `numberOfLines={stacked ? undefined : 2}` and `const longName = identity.state === 'ready' && (identity.name?.length ?? 0) * textScale > LONG_NAME;`.

6. **Low, iOS only. On the number pads the hidden footer is hard to bring back.**
   - **Where:** `src/ui/workerProfile/WorkerProfilePresentation.tsx:39`.
   - **What happens:** the iOS number pad (capacity, radius) has no return key and iOS has no Back. The ScrollView has no `keyboardDismissMode`, so only a tap on empty space brings the footer back.
   - **Fix:** add `keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}`.

7. **Nit.** `src/ui/workerProfile/WorkerAiPresentation.tsx:17`: `ruleDate` compares against the device's year, while `src/lib/vreme.ts:37-38` compares against Serbian "today". Use the same source; they differ only on New Year's Eve.

**Still open, as the fixer said:** the emulator loop at 320/360/390/430 dp and font scale 1.3, with long names and the keyboard open in both sticky-footer screens (radnik, lokacija). Issue 1 also needs to be checked there.

**Owner list:** the fixer's list is accurate and complete. Nothing in it was decided without asking.