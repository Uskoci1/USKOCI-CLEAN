# R21 — task and Agreement flow clarity

**Latest result:** dcb19e97 exact APK passes cold Discovery peek and two consecutive deep detail/Back returns on emulator. CI 36279059657 passes TypeScript and all 323 suites / 6,527 tests. See `NATIVE_RECEIPT.json`; this does not certify a physical phone or the full real-user journey.

Source package based on 60b52f5b. This report distinguishes implemented source from a verified native APK. No server, Edge, database, dependencies, payment or AI-provider changes belong to this package.

## Decisions grounded in the current screens

| Surface | User decision | Source change | Native acceptance still needed |
| --- | --- | --- | --- |
| Discovery list | Which nearby task should I open? | Separate compact task cards, a short actual list count, and an explicit point-free section when an area or public point is selected. | Cold peek, full sheet, selected card, detail/Back twice, long list. |
| Task detail | Does the work fit me / what did I publish? | Task title precedes lifecycle text. Core facts and price precede application management. Capacity uses the fraction; the accessible description retains the full meaning. | Title/facts at normal and large text, photos, footer, long description. |
| Task card | Compare work quickly | Full-width compact title and value; occupancy is not repeated as a separate partial/full status. Draft/closed and account relationship labels remain. | Narrow layout, multiple price modes, no invented rating or amount. |
| AI interview | Turn my words into a task | Brand mark on assistant replies, one ready-for-review action beside the composer, and saved photographs in the thread through AuthorizedPhoto. No prompt/provider change is claimed. | Keyboard, ready state, image editor return, account/focus cleanup. |
| Confirmed publication | Find the task I just published | Public-list readback resolves the published ID before selecting its card and camera; point-free tasks use the list. Missing/error cases retain an honest route to the owner detail. Publication exits to Home in one Back. | Native map readiness, shared point, remote task, failed read, Back. |
| Agreement overview | What task is this and what do I do next? | Source task link, existing next action, then separately readable accepted terms. Chat remains secondary. | Both roles, terminal state, keyboard/Back, long title. |

The supplied Airbnb screenshots support one focused surface, clear hierarchy, white space and continuous map/list context. USKOČI retains its own colors, fact illustrations, brand and product rules. No travel-specific controls or invented filter counts were copied.

## Boundaries

- Public maps still use only rounded public coordinates. The detail marker adds the existing brand inside an approximate-location halo; no private precision is introduced.
- No AI response-quality claim follows from these UI changes. Natural route/date interviewing still needs a separately authorized provider/device check.
- Text and photo chat are existing features. Voice messages and paged history remain open in the V1 closure plan.
- Discovery currently reads up to 25 pages of 200 tasks before client filtering. Existing clustering/virtualization is not proof of efficient server queries or 3,000-task production load.
- The existing R20 native sheet/scroll candidate remains unaccepted until this package is checked on an exact native build.

## Verification

Before this consolidated package, 8 focused suites / 401 tests passed. An earlier full run had 314 passing suites and 8 failing suites: three stale UI expectations were updated, while five suites encountered Windows child-process EPERM/status-null errors. That earlier run is not final acceptance. Final consolidated checks and native receipts will be recorded separately.

Final consolidated verification: TypeScript PASS; all 323 Jest suites / 6,526 tests PASS (307.448 seconds, exit 0). Existing worker teardown warning remains. `CHECKS.json` records source-file hashes and the raw result digest. The inert Agreement gallery now mirrors task link / next step / accepted terms. Exact APK/native review is the next gate.

Control publication: local state regenerated; the authenticated artifact still displays 2026-09-24 after the browser file chooser timed out. Remote upload is not claimed.

## First exact native build — f817336d

GitHub run 36276992515 built the x86_64 APK from f817336d4536a126465e3562c4efc200cf9c3f1a (tree 3a87f981f1098e109e6cf6902e3efa9ed6115a4e). Recovery/icon attestations passed. SHA-256: 7e45bf07afc835ebadee7bf718cc65493455a5a122f70470fd1ace5eceaa3034. Installed with adb install -r on emulator-5556; installed base.apk matched. No physical phone was connected.

Observed in inert native galleries using the real presentation components:
- Distinct task cards and a short task count render in the full Discovery list.
- Agreement task card precedes the next step and accepted terms.
- Ready AI draft has one review action; with the Android keyboard open both the review action and composer remain reachable. This is layout evidence, not a provider conversation. The ready fixture's unrelated example text was corrected in the follow-up source.
- **FAIL:** Cold Discovery entry has no visible peek header. Native reports index 0 at 724.2 dp; screenshot and UI hierarchy have no sheet header. Opening a filter renders the full list. The first native mount/draw path is under investigation; coordinates alone do not prove its cause.
- Deep return twice is not accepted: rapid scripted swipes entered a sample detail, so that attempt was discarded. A slower controlled run is required.

Local evidence root: outputs/r21-native-20260927 (APK.emulator.json, new-cold-map-settled, new-agreement, new-ai-keyboard-settled). Captures after new-return-first dump the idle UI hierarchy before taking the image; earlier captures may show a transition and are not treated as settled comparisons.

## Native follow-up source

The first sheet mount now uses its calculated initial detent and Gorhom mount animation; retained keyed remounts retain the earlier behavior. This is a bounded response to the observed cold-draw failure, not yet a verified native fix. Reduced motion still passes duration 0. The ready AI gallery fixture now has consistent translation-task text.

TypeScript passes. The follow-up full run completed with 322/323 suites and 6,526/6,527 tests passing; one unchanged Firebase config child process returned null status. Its isolated retry passed all 13 tests without any code/config change. Focused Discovery: 130/130. Do not describe that full invocation as green.

A subsequent controlled run on the first f817336d APK did verify two consecutive returns from local task 10/1000, without intervening scroll: visible rows 9–12 and their bounds match exactly (e.g. task 10 [56,759][1026,1404]). Evidence: r21-deep-baseline-3, r21-deep-detail-1-settled, r21-deep-back-1, r21-deep-detail-2-settled, r21-deep-back-2. This replaces the discarded rapid-swipe attempt only for the first APK. It does not accept the cold header or certify performance/real server load.

## Final bounded native acceptance — dcb19e97

APK run 36279078038, source dcb19e9787e10918f81b19239fe1fa1bef5661b4, tree 1f54cfea29a978bebfec6e759ae2d7f95b9895b6. APK and installed base.apk SHA-256: 4110c7b6d5e3edce3760a30e8b62e1adb681301128797685f5efc21864c121e3. Installed on emulator-5556 with data preserved.

- Cold launch: map and visible 1000-task peek header, verified in the screenshot and XML.
- Full list: separate cards, compact capacity.
- Scroll to local task 10/1000; open detail and Back twice without an intervening scroll: visible rows and bounds equal the baseline on both returns.
- AI ready fixture: consistent example copy; review action and composer remain visible above the actual Android keyboard. No prompt/provider call was made.

The installed follow-up resolves the observed cold-header failure in this tested configuration. Reduced motion, large font and physical-phone acceptance remain scoped follow-ups. All native inputs/figures are local fixtures; no test records were written to DEV. The immutable screenshots/XML and a hash manifest are committed in native/ and NATIVE_RECEIPT.json. The earlier failed APK is retained in the narrative so its result is not overwritten.

Next coherent implementation batch: finish the real publication-to-map selection journey (point, shared point and point-free task), shorten date-heavy task-card copy without dropping timing facts, then align Agreement/chat navigation and attachments with the existing recovery rules. Voice messages and paged chat are separate unfinished V1 capabilities, not implied by the new layout.
