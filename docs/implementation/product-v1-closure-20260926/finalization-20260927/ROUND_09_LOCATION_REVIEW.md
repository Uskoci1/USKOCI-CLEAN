# Round 09 — finish the location decision before publication

2026-09-27. Client-only follow-up to Round08. The person's job is to inspect and confirm the actual task places, and correct one without losing another.

| Field | Outcome |
| --- | --- |
| Problem | Editing a private access note removed an explicitly selected provider pin. Discarding a point edit in the final form lost the previous confirmed point. The final review showed only an inert public anchor and a count of private points. The picker printed coordinates and repeated instructions. |
| Cause | Private-text edits shared the candidate-removal path; the form deleted its confirmed baseline on invalidation; the review still used the earlier single-point canvas. |
| Product decision | Keep geometry while editing its details, require a fresh explicit confirmation, restore the last confirmed value on discard, and show all owned confirmed points before publication. |
| UX/UI | One short map instruction; exact coordinates remain available to assistive technology. Existing private address/access notes are visible in the disclosure summary. A candidate address can be copied only through an explicit action. Public/coarse and owner/private map sections remain clearly separate. |
| Implementation | The private-text path retires obsolete callbacks and lookup results without clearing selected geometry. The final form retains confirmed points but excludes a pending edit from its count and blocks Save. A normalized owner map follows canonical topology and uses the existing expanded-map/navigation component. |
| Files | `LocationPointEditor.tsx`, `NeedLocationForm.tsx`, `ResolvedPinMap.tsx`, `ReviewPresentation.tsx`, `reviewFacts.ts`, `pregled-zadatka.tsx`; focused regressions listed in `ROUND_09_CHECKS.json`. |
| Backend/RPC | Unchanged. No automatic address assignment, confirmation, GPS request, geocoder call, provider call or server application was introduced. No dependency, payment, certificate, TaskCard or DiscoveryPeek change. |
| Tests | TypeScript PASS; five focused Jest suites / 173 tests PASS. The first parallel invocation was blocked before executing tests by Windows spawn EPERM; the same selection passed in-process. Exact logs and hashes are in `ROUND_09_CHECKS.json`. |
| Device proof | NOT RUN: no native build/install, screenshot, actual map gesture, external Maps launch or AI conversation. These remain exact-build acceptance work. |
| Regression | Explicit address adoption cannot invoke a stale retained callback or confirm a point. Private text retains geometry but requires reconfirmation. Discard restores the latest confirmed point; geography/country changes still invalidate old coordinates. Public map receives only the coarse anchor; private topology is normalized against its binding. |
| Independent review | A separate source reviewer found one obsolete map-instruction test expectation; corrected before the successful focused run. No runtime issue was found within that bounded source review. |
| Git | Source hashes are recorded in the check receipt; the enclosing source commit and later control refresh provide the Git identity. |
| Status | CLIENT IMPLEMENTED / TYPES AND FOCUSED TESTS PASS / DEVICE PENDING. This is not certification of the entire AI system. |
| Next | Consolidated device acceptance for the location path, then connect the separately proved chat history/exact-message contract after explicit DEV approval. |

## Boundaries retained

The public view still has one approximate point. The new multi-point preview is in the **owner's private pre-publication review**, not a new public route projection. A complete road route is not invented: explicit navigation hands actual confirmed coordinates to Maps under the Round08 limits. Incomplete routes never silently omit a stop. Candidate labels do not overwrite a manually entered private address unless the person chooses that action.

Provider extraction quality, ambiguous natural-language places and voice recognition were not exercised by this source package. The proven old end-to-end journey remains historical; this package requires its own eventual device acceptance.
