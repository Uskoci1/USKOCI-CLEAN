**Verdict: fix first.** The fixes are real and I found no regressions in them. Three small presentation problems remain, and they would show on a phone. The owner's rule also applies: none of these screens is done until the emulator photo loop has been run, and this round has not been photographed at all.

I read commits 4fa6a58d and d1896db9 against 644cab09 in `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN\.claude\worktrees\wf_6f7600b3-c18-5`. The 9 changed and neighbouring suites pass: 234 tests. On the first parallel run, `agreement-collection-presentation` failed its first test on the 5 s timeout, then passed 19/19 when re-run alone. That is the same first-run timeout the fixer saw.

**Checked and correct**
- **Moje prijave:** a chosen offer now says "2 osobe", never "Dolazi". The error text no longer guesses a cause, and "prijave" is lower-case mid-sentence.
- **Worker AI thread:** a saved message is shown once, not again as "šalje se".
- **Voice:**
  - Switch Access and Voice Access now reach the hold advice and "Govori bez držanja" through the `activate` action.
  - Voice mode now closes on the controller's session. The controller keeps the session on success and clears it on cancel, so this holds.
- **Messages:** a message with text and photos is heard with both.
- **Photo button hint:** the grey × names the real reason it stays open.
- **Dogovori card foot:** it uses `ownerFoot` now. Its corners match the `cardCompact` card, which has padding 0.
- **Gallery:** it follows the route, including the proposal lines, the group sentence, Kontakt, Lokacija and the problem card.
- **New "čeka te" line above Poruke:**
  - It uses the step card's exact words and shows nothing when the other side is the one waiting or the rating read failed.
  - It keeps the orange budget: a dot plus text in the `warn` colour, no fill.
  - Its contrast is about 6:1 and its touch area is at least 56.

**Remaining issues, most severe first**

1. **Should fix: the "čeka te" sentence can be cut off.** `src/ui/v2/AgreementPresentation.tsx:126`
   - At 320 dp the text column is about 190 dp wide. At text scale 1.3 or more, "Završetak je označen i čeka tvoju potvrdu" (41 characters, 14 px bold) does not fit in `numberOfLines={2}` and ends in "…". That is the one sentence that tells the person what waits for them.
   - At `:188`, `alignItems: 'center'` also puts the 8 dp dot between the two lines instead of beside the first.
   - **Fix:**
     - In `AgreementHero`, read `const scale = useTextScale();` and set `numberOfLines={scale >= 1.3 ? 4 : 2}`.
     - Change the row to `waiting: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }`.
     - Wrap the dot as `<View style={{ height: Math.round(sys.type.note.lineHeight * scale), justifyContent: 'center' }}><WaitingDot /></View>`.

2. **Should fix: in an empty thread, "Osveži poruke" stands above the empty state.** `src/ui/AgreementChat.tsx:167` with `listCentred` (`:270`)
   - Order today: the refresh link, then the 72 px drawing, then "Napiši prvu poruku". The action comes before the headline. The error state (`:168-173`) puts its action underneath.
   - **Fix:**
     - Head action: `{!error && !terminal && (shown.length > 0 || local.length > 0) && !(loading && !shown.length) ? <ChatAction label="Osveži poruke" … center /> : null}`
     - In the empty block (`:177-179`), after "Poruke vide samo učesnici ovog Dogovora.", add `<ChatAction label="Osveži poruke" onPress={() => void refresh()} center />`. This goes in the non-terminal branch only.
   - The test at `agreement-chat-ui.test.tsx:~305` finds the action by its label, so it keeps passing.

3. **Should fix (the photos may confirm it): the profile row in the offer sheet has no visible word.** `src/ui/v2/CandidateFace.tsx:234-240`
   - Now that the name is the sheet title, the row is only the picture, the rating and a caret. For a new person it reads "[AB] Ocena nije dostupna ›". A caret on a negative fact looks like a dead row, or like a link to the rating.
   - **Fix:** under `<CandidateTrustLine … lines={3} />`, add `<T style={{ ...sys.type.note, fontWeight: '600', color: sys.color.green }}>Pogledaj profil</T>`.

4. **Should fix (copy, older than this round, but the gallery copied it): a gendered form.** `src/app/dogovor/[id].tsx:401` and `src/app/dizajn-dogovori.tsx:193`
   - "Broj druge strane: Nisu podelili svoj broj" uses a masculine plural ending ("podelili") for one person, called "druga strana", which is feminine singular. This breaks the gender-free rule.
   - **Fix:** `{dogovor.kontakt.njihovTelefon ?? 'još nije podeljen'}`, and the same words in the gallery.

5. **Nit: a stale comment.** `src/ui/v2/AgreementCollectionPresentation.tsx:289` still says "the foot lies on the card's own white". It is now the wash under one hairline.

6. **Nit: the Moje prijave error repeats itself.**
   - The title "Prijave trenutno nisu dostupne" and the body "Prijave nisu učitane. Pokušaj ponovo za trenutak." say the same thing, and the button then says "Pokušaj ponovo" again.
   - **Fix:** in `src/app/(app)/moje-prijave.tsx:116`, use `'Pokušaj ponovo za trenutak.'`, and mirror it in `src/app/dizajn-prijave.tsx:89`.

7. **Nit, older than this round: the summary's spoken name leaves out its visible title.** At `AgreementPresentation.tsx:120`, the compact summary above Poruke is labelled "Pregled uslova Dogovora". Its visible title is not part of that label, so Voice Access users cannot say what they see.
   - **Fix:** `` `Pregled uslova: ${readableTitle(a.naslov)}${waiting ? `. ${waiting}` : ''}` ``, then update the `startsWith` in `pkg011-agreement-workspace.test.tsx:237`.

**Open, and correctly not decided by the fixer**
- **Owner's decision:** the offer sheet's "Sposobnosti" section shows the applicant's self-declared skills to the requester. This needs checking against the no-skill-label rule.
- **Emulator photos still needed:**
  - `/dizajn-prijave`, `/dizajn-kandidati` and `/dizajn-dogovori`, including the new "Poruke · čeka te" scene, at 320, 360, 390 and 430 dp and at large text.
  - Items 1 and 3 above should be confirmed or ruled out on those photos.
  - The white space in compare mode (rk item 2) should also be judged there. The fixer's reason for not changing it holds: the cells run Ukupno, Ljudi, Termin, so lining them up from the bottom would move the Ukupno and Ljudi cells whenever the Termin text wraps differently.
- **Files the fixer does not own:**
  - `ProductSheet.tsx`: the × scrolls away on a long message.
  - `src/app/(app)/oceni-dogovor.tsx:20`: the fallback Back label always says "Nazad na Dogovore".
  - The ru5 device scripts still tap old labels.
  - `TaskFace` still has the unused `danger` foot tone.
  - `StateView` has no way to show why a disabled action is grey.