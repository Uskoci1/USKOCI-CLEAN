**Verdict: ship.** All 31 review items are done or reasonably reasoned out. No guard, fence, revision, idempotency, consent, closure, export, support or read-marking path is weaker, and no legal or privacy wording changed. The three issues left are low severity and none blocks the merge. The emulator check is still open, and the owner's screenshot loop needs it before these screens count as done.

**What I checked (fixer's worktree `wf_6f7600b3-c18-4`, 644cab09..e9a82226)**
- **Type-check:** `npx tsc --noEmit -p tsconfig.json` exits 0.
- **Suites:** 33 suites, 783/783 pass. They cover the 8 changed test files, every suite that imports a changed module directly or through a route, and the copy, token and screen-title contract suites. The 8 unit suites also pass at the default 5 s timeout (173/173).
- **Tests not weakened:** the only removed test lines are three renamed titles and three expectations that pinned the old look, each replaced with a comment. `afterEach` now also asserts that no Back listener is left behind, so it is stricter. The wip's tone test was changed from danger to warn, which matches the review's rule "danger only without a pending send".
- **Moved words:** the six messages moved into `supportCopy.ts` and `closureUnconfirmedCopy` are byte-identical to the base.
- **Ownership:** all 21 files belong to the unit. The fixer's commit touches exactly the 6 files the report names. No dependency changed and nothing is uncommitted.
- **Line endings:** every file, including the new `supportCopy.ts`, is fully CRLF, as in the base.
- **Rules:** no "server" wording. The remaining off-scale spacing values are 2 px micro-gaps, the same as the settings screens use. `bubbleTime` now uses the 13 px meta token.

**Review items, read in the code**

| Review | Item | Status and where |
|---|---|---|
| tok | 1 | Done, with issue 1 below. `SupportNewScreen.tsx:123,136-154,224-225` |
| tok | 2 | Done. `:63` uses `router.replace`, and the (app) tab router drops the left route on REPLACE (`(app)/_layout.tsx:75-86`) |
| tok | 3 | Done. `SupportPresentation.tsx:149`, comment corrected at `:131-135` |
| tok | 4 | Done. `SupportInboxScreen.tsx:43` |
| tok | 5 | Done. `ClosurePresentation.tsx:45` |
| tok | 6 | Done. `PrivacyPresentation.tsx:56` |
| tok | 7 | Done. `ExportPresentation.tsx:70`, plus the gallery scene |
| tok | 8 | Done. `PrivacyPresentation.tsx:62,92` |
| tok | 9 | Done. `SupportNewScreen.tsx:115-119` |
| tok | 10 | Done. `supportCopy.ts:24-29`. In practice a refused send always leaves `pending` set (`SupportController.ts:107`), so it shows as warn, as the review allowed |
| tok | 11 | Done. `SupportDetailScreen.tsx:47-54`; the stale-press fence still follows the revision (`:77-80`, tested) |
| tok | 12 | Done. `SupportNewScreen.tsx:234` |
| izgled | 1-11 | All done: `ExportPresentation.tsx:55`, `ClosurePresentation.tsx:106-107`, `ClosureDialog.tsx:95`, `SupportContextEntry.tsx:72,92`, `SupportDetailScreen.tsx:87,138`, the radio groups, `PrivacyPresentation.tsx:78-85`, the spacing values, and the gallery text |
| zastite | 1 | Done. `SupportContextEntry.tsx:68,77`; the preview sheet still can't be closed while its continuation runs (`ProductSheet.tsx:97,131`) |
| zastite | 2 | Done. `SupportNewScreen.tsx:165-166,205,210` |
| zastite | 3 | Done. `SupportDetailScreen.tsx:57` |
| zastite | 4 | Mostly done; see issue 3 below |
| zastite | 5 | Done. `SupportDetailScreen.tsx:138` |
| zastite | 6 | Done, except while a send is running or unconfirmed, as the report says with its reason |
| zastite | 7 | Done |
| zastite | 8 | Done. The header copies 11a exactly (`meta`, muted, weight 600, 4 px in, 8 px gap) |

**Remaining issues, most severe first**

1. **Low: "Odbaci" can do nothing after a reload settles.** `SupportNewScreen.tsx:136-142` and `:225`.
   - The question now also appears in LOADING (`:123`). A typed form reaches LOADING through "Proveri dostupnost" from the error state.
   - The question keeps the `back` / `navigate` of the render that asked it. Those check `controller?.snapshot() === state` (`useSupportController.ts:40-41`).
   - If the load finishes, or fails again, while the question is open, "Odbaci" closes the question and does nothing.
   - Fix: in `NewContents`, add `const exits = useRef({ back, navigate }); exits.current = { back, navigate };`. Then use `const leave = () => discard(() => exits.current.back());` and `onPress={() => discard(() => exits.current.navigate(() => router.push('/profil/privatnost')))}`.
   - Test to add: type text, fail `capabilities`, press "Proveri dostupnost" with the second read held, press Back, resolve the read, confirm, then expect `mockRouter.replace('/podrska')`.
2. **Low: a failed mark-read reads as "waiting" while a reply is unconfirmed.** `supportCopy.ts:28`.
   - `|| state.pending` turns every message warn. "Označi prikazane događaje kao pročitane" is only `disabled={busy}` (`SupportDetailScreen.tsx:170`), so it can run with a pending reply, and its failure then shows in plain ink with no alert.
   - Fix: have the controller record what the last message is about (for example `messageOf: 'SEND' | 'MARK'`: SEND in `submit`/`replay`/`cancel`/`recoverPending`, MARK in `markRead`). Return warn only when `messageOf === 'SEND' && state.pending`.
3. **Low: the send button spins while the person stops a send.** `SupportDetailScreen.tsx:137` and `SupportNewScreen.tsx:172` (the second predates this change).
   - `cancel` sets `phase: 'SENDING'` and keeps `pending` (`SupportController.ts:122`). So during "Zaustavi prethodno slanje" the reply's send area, and the "Pošalji privatni zahtev" footer, show a sending spinner.
   - Fix: add a `command: 'SEND' | 'CANCEL' | 'MARK' | null` field to the controller state and show the spinner only when `state.command === 'SEND'`.
4. **Verification gap, not code.** The emulator check of "Da, trajno zatvori nalog" is still open. It is a sheet opened over the full-screen Modal and the only way to confirm closing the account (`ClosureDialog.tsx:28,162`). The 320 dp / large-text check is also open.
5. **Nit, gallery only.** `dizajn-privatnost.tsx:133`: "u dogovoreni termin" should be "u dogovorenom terminu".

The `/profil/zatvaranje` route line in `src/app/(app)/_layout.tsx` is still unowned by this unit, as the report says. The owner-decision list is complete: "Zatvori pregled", "na redu", "Učitavamo tvoje Dogovore…", and the three label changes. "Najpre proveri prethodno slanje.", "Učitavamo sačuvano stanje…", "Stanje zahteva nije učitano." and "Skrati tekst pre slanja." are existing words reused.

Files, all under `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN\.claude\worktrees\wf_6f7600b3-c18-4\`:
- `src\ui\support\SupportNewScreen.tsx`
- `src\ui\support\supportCopy.ts`
- `src\ui\support\SupportDetailScreen.tsx`
- `src\ui\support\SupportController.ts`
- `src\ui\support\useSupportController.ts`
- `src\ui\closure\ClosureDialog.tsx`
- `src\app\dizajn-privatnost.tsx`