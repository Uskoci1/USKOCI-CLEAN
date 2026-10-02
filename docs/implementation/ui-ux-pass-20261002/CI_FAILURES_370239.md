# Existing CI failures — classification and bounded correction

Read-only logs: PKG006 run37023907809 and P5 run37023907851, source a49132a8. No workflow rerun and no tests executed. Corrected copies are under `ci-existing-test-corrections/src/data/__tests__/`; canonical source untouched.

PKG006: 2 failures/162 passes. P5: 10 failing suites,21 failed/9204 passed tests. The21 observed failures match intentional copy/layout/menu changes on static source inspection. No missing HITNO import/mock failure or demonstrated runtime defect appears in those failures. This is **not a green test result**: assertions later in each interrupted test did not execute; corrections are source-reviewed only.

| Existing file | Correction; meaningful checks retained |
| --- | --- |
| application-selection-native.test.tsx:272 | Exact full new total-price explanation; unchanged total amount, invalid numeric suffix/overfill and direct guarded submission checks. |
| application-composer-read.test.tsx:224 | Tvoja ponuda → Tvoja prijava; unchanged lost-ACK journal, remount, no automatic resend, same ID/payload and clear-on-receipt checks. |
| ai-owned-intake-screen.test.tsx:758 | Compact card now uses paddingVertical8 rather than gap4; complete visible safety note, expanded disclosure and pending-review refusal remain. |
| push-preferences-native.test.tsx:115,120,124,132,212,245,311,313,319,325,352 | Renamed transport/unchanged-save copy and role-specific disable action (`Isključi za moje zadatke` / `…moje prijave`). Positive and negative selectors updated. Revision/settings preservation, phone registration separation, missing-proof honesty and save-reason stability retained. |
| locationPointEditor.test.tsx:269,285,288,392,402 | Je l’ ovde? → Proveri pin, pa potvrdi mesto.; Nije ovde → Ispravi mesto. Explicit-confirm-only, hidden alternatives, private-address invariance, no duplicate search and inert gallery remain. |
| candidate-face.test.tsx:86 | Current intentional full message is unclamped, replacing obsolete two-line expectation. Exact content/order, accessible complete facts, single press and open callback retained. |
| pkg011-slice4-presentation.test.tsx:42,74,89 | Count-aware link label now `Otvori prijave. …`; owner decision order places applications before budget. Still asserts available/history counts truth, one primary, retained price/facts, no fabricated basis and no unavailable-selection promise. |
| own-task-menu-screen.test.tsx:85,128–136 | Exact menu arrays include new HITNO. Agreement/close-search targets selected by label after insertion, not obsolete index. All confirmation/cancel behavior, no pre-confirm send, lifecycle receipt/journal and navigation checks unchanged. No new mock. |
| dizajn-obavestenja-gallery.test.tsx:51 | New NOT_READY copy; still distinguishes phone preference from sender readiness and checks no production call. |
| pkg004-lifecycle-wiring.test.ts:11 | Existing route-identity assertion accepts explicit fragment containing HITNO plus lifecycle. Regex still requires uuid(id) gate and lifecycle need/id wiring; loading/error recovery, post-readback and immutable command assertions unchanged. |

Potential unexecuted later layout assertion in the published-task test was also reconciled after inspecting `NeedPresentation`: owner applications now precede the retained budget. No broad geometry relaxation, test removal, skipped test, increased timeout, changed business fixture or runtime edit was made.

Independent source review identified one additional later copy assertion in push-preferences-native.test.tsx:121: the non-delivery-proof sentence now reads `Ova provera ne potvrđuje da je obaveštenje stiglo na tvoj telefon.` This assertion was updated exactly; both no-call assertions remain. The original failure at120 had prevented121 from running. No tests were run after this correction.

## Parent integration

The ten reviewed existing test files were integrated after independent read-only review. No tests were removed or skipped, and no workflow was manually rerun. Runtime source is unchanged from a49132a8. These corrections have SOURCE review only until a later automatic CI result is read. Earlier failed runs remain evidence.
