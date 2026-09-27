# D06/D07 change/cancel exit retirement — 2026-09-27

One reproduced client lifecycle defect, reviewed at `cb63b847cd39980f0b67fd437d07c3e4d8e78328`.

Before: an UNKNOWN proposal/cancellation can explicitly retry its exact original
command. That retry first awaits opaque journal persistence. Its hub still offers
header Back; pressing it navigated without retiring the controller until blur.
If persistence finished in that gap, the proposal/cancellation writer ran after the
person had left. Repeated Back also navigated twice, and foreground could recreate
the controller before the pending blur.

Three focused red regressions confirmed this: PROPOSE and CANCEL each made writer
call 2 after Back (expected only the original call), and background/foreground in
the exit gap made read call 2 (expected 1). No backend or real mutation was used.

`AgreementActionsScreen.tsx` now retires its owner and disposes the existing
controller synchronously before navigation. A leaving latch blocks foreground
revival until a fresh focus. Header and Android hub Back share this exit path;
repeated Android exit presses are consumed while departure is pending. Back within
a form/review retains the existing close-step/wait-during-send behavior.

Opaque journal persistence/recovery is untouched. A return creates a new controller,
reads the same journal and asks for exact re-entry where required; it never replays
the command automatically. Already-started server mutations cannot be canceled by
this client change, and their original read-first recovery remains necessary.

Changed only the screen, its existing focused suite and this report. No controller,
service, accepted terms, authority, confirmation copy, main Agreement route,
TaskCard/Peek, dependency, server or shared control changes.

Validation: initial targeted **3 FAIL / 19 skipped**; first green screen/controller
run **54/54 PASS**; added explicit Android pending-retry/double-Back regression;
final two suites **55/55 PASS**, 12.865s. Scoped `git diff --check` PASS.
No build, device run or commit. Root owns integrated TypeScript/native acceptance.
