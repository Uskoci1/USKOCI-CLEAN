**Verdict: fix first.** Two small defects remain in the support screens, each a few lines. Everything the three reviews asked for is in place, and what I read in the code matches the fixer's report.

**What I checked** (read-only, branch `g-round5d-privatnost` at `e9a82226`, compared with `644cab09`)
- **Tests.** The unit's 11 suites pass. With the default 5 s limit, 5 tests timed out under load, all in `SupportScreens`. Re-run with `--testTimeout=30000`, the other 10 suites pass, 203/203, and the gallery passed in the first run. The working tree is still clean.
- **Back from a confirmed request.** `router.replace` really drops Novi zahtev from the history. The tab router's REPLACE is handled as a jump plus `withoutLeft` in `src/app/(app)/_layout.tsx`, so Back from the case returns to where the person started.
- **Android Back on Novi zahtev.** The hardware Back listener is set up correctly. `ConfirmSheet` and `ProductSheet` are native Modals, so they take Back first.
- **Spacing.** The spacing tokens exist (`xxl` is 32). No listed off-scale value is left.

**Remaining issues, most severe first**

1. **Medium: the wrong button spins while a send is being stopped.**
   - `SupportNewScreen.tsx:172`: `loading={state.phase === 'SENDING'}`. `cancel()` and `replay()` also set `SENDING` (`SupportController.ts:113,122`), and `missing` at `:115` returns null during `SENDING`. So pressing "Zaustavi prethodno slanje" draws the green "Pošalji privatni zahtev" with a spinner, spoken as busy: it says "sending" while the person stops a send.
   - `SupportDetailScreen.tsx:137` has the same problem: during a cancel, `state.pending.kind === replyKind` is still true, so the reply's send well turns green and spins.
   - The recovery buttons themselves (`SupportPresentation.tsx:107-109`) never show a spinner.
   - This breaks the "its own spinner" rule this round applied elsewhere.
   - Fix: in `NewContents`, add `const [submitting, setSubmitting] = useState(false)`. Set it in `send()`, and clear it with `useEffect(() => { if (state.phase !== 'SENDING') setSubmitting(false); }, [state.phase])`. Then use `loading={state.phase === 'SENDING' && submitting}` and change `:115` to `(state.phase === 'SENDING' && submitting) || (!disabled && valid) ? null`. Do the same in the detail view for `sending`.
   - In `SupportRecovery`, take a `working: 'read' | 'cancel' | 'replay' | null` from `SupportRecoveryPanel` (local state set before each command, cleared when not busy) and pass `loading={working === '…'}` to each of the three buttons.

2. **Medium-low: the same warning shows and is spoken twice (made worse by this change).**
   - `SupportNewScreen.tsx:181` now draws `supportCopy.absent` ("Potvrda prethodne radnje još nije pronađena.") as a `warn` note with `alert`. It sits under the recovery panel, which already says "Potvrda još nije pronađena…".
   - Before this change the second note was a quiet, non-alert note. Now there are two yellow boxes and TalkBack reads both. The gallery scene "Novi zahtev: Nepotvrđeno slanje" (`dizajn-privatnost.tsx:259`) shows exactly this to the owner.
   - Fix: render the note only when `state.message && !(state.pending && state.message === supportCopy.absent)`. Apply the same condition to the composer line at `SupportDetailScreen.tsx:131`.

3. **Low: a locked, empty reply field is told to type.**
   - `SupportPresentation.tsx:228`: `why = … empty ? 'Unesi tekst pre slanja.' : reason`. The empty check wins over the caller's reason.
   - Case: the person comes back to a case with an unconfirmed reply. The text was reset (`:43`), and the field is not editable while the send is unconfirmed. TalkBack still says "Unesi tekst pre slanja." instead of "Najpre proveri prethodno slanje."
   - Fix: `const why = sending || canSend ? undefined : reason ?? (empty ? 'Unesi tekst pre slanja.' : undefined);`

4. **Low: the claim "a refused send is drawn as failed" is not quite accurate.**
   - After every failed send, retry or recovery read, the controller keeps `pending` (`SupportController.ts:61,107,116,125`). So `supportMessageTone` always returns `warn` there.
   - The `danger` branch only happens for a failed "mark as read" and in the `ERROR` state. The drawing is honest (the outcome really is unconfirmed), but the report and the comment at `supportCopy.ts:707-711` overstate it. Correct the wording; no code change is needed.

5. **Low: one closure message is drawn as a failure while it waits.**
   - `ClosurePresentation.tsx:106` checks only two exact strings. The catch message 'Stanje zahteva nije potvrđeno. Sačuvani zahtev ostaje za proveru.' (`ClosureDialog.tsx:83`) is drawn as danger even when a start or preparation is saved and waiting. That contradicts the "unconfirmed is waiting" rule used in support.
   - Fix: move that string into `closureUnconfirmedCopy.CAUGHT`, and set `waiting = message is START or PREPARE, or (!!intent && message === CAUGHT)`.

6. **Low (copy for the owner): the unavailable-copy step points two ways.**
   - For a copy that cannot be saved, the step says "…Proveri stanje zahteva." (`ExportPresentation.tsx:70`, copy at `:16`). The one green action is "Zatraži novu kopiju" (`src/app/(app)/profil/izvoz.tsx:174`).
   - Ask the owner for step words with no instruction in them (for example "Ova kopija se ne može sačuvati."). New words are not decided here.

7. **Low (from before this change, in owned files): export buttons swap their words while working.**
   - `izvoz.tsx:167,172-173` change the label to "Preuzimanje i čuvanje…", "Radnja je u toku…" and "Slanje zahteva…" instead of keeping it with a spinner. That is the loading rule this round applied in support.
   - Fix: keep "Preuzmi i sačuvaj", "Pripremi kopiju" and "Zatraži novu kopiju"/"Zatraži izvoz" with `loading`, and update the gallery scene "Čuvanje u toku (onemogućeno)" to match.

8. **Nit: the support scenes' back arrow does nothing in the gallery.** In `dizajn-privatnost.tsx:118`, `navigate: noop` makes every support scene's arrow a dead button for the owner. The review allowed this. The fix is to build `model` inside the component with `navigate: () => toList()`.

9. **Nit: a triple separator in the inbox row.** At `SupportPresentation.tsx:149`, `vreme()` already contains " · ", so the row reads "24. sep · 12:00 · #71". Consider `#${caseNumber} · ${time}`.

**For the owner list, in addition to the fixer's items:**
- "Zatvori pregled" is also the X's spoken label on "Nalog je zatvoren." and "Zahtev je pokrenut.", where nothing is being reviewed.
- "na redu" is also spoken for PROCESSING, which really is running.

**Still open, as reported:**
- The `/profil/zatvaranje` route line in `_layout.tsx`, which belongs to another unit.
- The emulator check of the confirmation sheet opened over the full-screen closure flow.
- 320 dp with large text.

Jest log: `C:\Users\user\AppData\Local\Temp\claude\C--Users-user-Desktop-USKOCI-CANONICAL-WORKSPACE-2026-09-08-USKOCI-CLEAN--claude-worktrees-uskoci-kompletan-audit-2e715e\76affeda-95a8-4142-8648-3324aae3af63\scratchpad\r5-verify-jest.txt`

Worktree: `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN\.claude\worktrees\wf_6f7600b3-c18-4`