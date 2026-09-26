# R21 — task and Agreement flow clarity

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
