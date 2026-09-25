# R15 — distinct task and Agreement surfaces

Owner correction: task cards, task detail and Agreements should be more striking and easier to scan, rather than
repeating one visual container. This supersedes the historical requirement that every card share the same outline.
White reading surfaces, strong moderate-sized type, real facts and current domain/recovery guards remain.

## Composition decisions

| Surface / decision | Alternatives considered | Selected composition |
| --- | --- | --- |
| Task card: is this work suitable? | Price-first price tile; image-first listing without guaranteed photos; work-first illustrated brief. | Green full-width work title, public place/time/requirement, separate price/capacity band, then the actual publisher. Soft neutral lift distinguishes the opportunity as one tappable object. |
| Task detail: do I want to apply? | Enlarged copy of the card; dashboard tiles for every fact; open editorial reading order. | Green heading, complete logistics, an illustrated price band, publisher, existing photos/requirements/description/map/questions. All values remain visible; no fabricated category or photo. |
| Agreement: what has been accepted and what is next? | Another advertisement card; invented arrival timeline; open person-led appointment. | Portrait and actual state, full accepted schedule, work and place on one rail, people/total and existing attention target. Its overview keeps the real next step ahead of the accepted appointment record. |

## Implementation

- Task cards use the existing neutral `sys.elevation.card` with no enclosing border. Bare map-sheet cards reset
  elevation and shadow, so the preview does not gain a nested frame. Existing whole-card press spring, reduced motion,
  accessibility summary and separate owner-application target are preserved.
- The task title keeps 22/28 type and becomes green. Place/time art is 24 dp; the financial band adds existing money
  or offers art. An offers statement has 16/22 green semibold type, while a missing price remains 15/20 muted words.
  Actual money remains 22/28 with its exact basis. No count, rating or state was invented.
- Public and owned details share the same logistics-before-price structure. The measured title's handoff to the top
  bar is unchanged. Exact price basis/total, public-location privacy, owner/applicant/unknown guards, state recovery,
  profile and safety entries, photo conditions and fixed action remain intact. Detail amount size is unchanged at 28/36.
- Agreements intentionally stop inheriting the enclosing task-card shape. The accepted schedule remains complete,
  including timezone. The rail groups terms; it is not progress. Status/attention priority, rating callback, list
  grouping/sorting and missing-price/remote handling are unchanged. See `../R15_AGREEMENT_DISTINCTION.md`.

## Verification

Typecheck exits 0. Full Jest: **314 suites / 6,114 tests pass**, 119.778 seconds. Existing worker teardown warning remains.
Focused task/detail coverage: 5 suites / 106 tests; scoped Agreement coverage: 6 suites / 50 tests. Existing visual
expectations were adjusted for the owner's new composition; behavior, privacy and recovery assertions remain.
No new tests merely mirror styling. Source-bound APK and native review are recorded separately when completed.

This is a three-surface client presentation batch. No backend, DEV data, Edge, payment, dependency, provider or key
change. It does not close keyboard anchoring R14-N01, real journeys, phone/iOS acceptance or store gates. The control
table retains those boundaries. No physical phone is currently connected; the authorized Android emulator is available.
