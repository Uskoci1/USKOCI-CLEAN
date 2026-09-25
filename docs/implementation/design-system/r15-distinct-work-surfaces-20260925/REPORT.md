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
No new tests merely mirror styling.

Source `13bb55c0fb957bae723f4811a615926b92090ca6` was built by APK run
[36150477204](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36150477204). Both attestations and exact
source/tree/run/hash/ABI were checked before successful emulator installation. Eight views were visually reviewed:
six inert presentation views and two actual routes read-only. See `CHECKS.json`, `APK.json`, `CAPTURES.json`,
`NATIVE_REVIEW.md` and `RECEIPT.json`. Ordinary text size is the baseline; one 320dp/font-1.3 view checks reflow
without prescribing larger normal typography. Emulator settings were restored. Real screenshots remain local.

Control rows B04/B06/A08/D01/D02 are updated and `node scripts/control/osvezi.mjs` completed. No phone light was
promoted; the server snapshot is still from 24 September. Import on the original authenticated Claude artifact
remains unconfirmed: its documented file chooser timed out and no file was uploaded. The generated local state
is retained. A local `R15_PREGLED.html` compares original R14/R15 screenshots with explicit fixture/read-only labels.
The browser URL policy rejected opening this local HTML; no alternate surface or serving workaround was attempted.
The page is delivered as a file, not claimed as browser-verified. The original native screenshots were inspected.

This is a three-surface client presentation batch. No backend, DEV data, Edge, payment, dependency, provider or key
change. It does not close keyboard anchoring R14-N01, real journeys, phone/iOS acceptance or store gates. The control
table retains those boundaries. No physical phone is currently connected; the authorized Android emulator is available.
