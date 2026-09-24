# Round 6 recovery and integration — 2026-09-25

## Scope and provenance

The owner approved recovering the interrupted local Claude work, verifying it, and publishing it to
`work/uskoci-ui-unification-20260924`. Integration uses a separate detached worktree. The Claude checkout and its
uncommitted files remain intact. No server, Edge, dependency, payment or migration changes belong to this package.

Remote baseline: `3d4cfb12076107605ec41ef24e7b23b115c8849d`.
Recovered local head: `25dd5d13ad24d91e9c02dfba571cc288c2c92640` (four commits ahead, none behind).
The cloud work was already merged by `0db57f50`; the three cloud round-6 branches have patch-equivalent changes
in this history. They were not merged a second time.

| Source | Recovered work |
| --- | --- |
| `97653c2d` | ProductSheet header, calendar clock artwork, Skeleton variants, StateView layout |
| `b1f394e6` | Application composer, its route and gallery, rating presentation |
| `94a550d7` | Group conversation, photo tray explanations |
| `25dd5d13` | Q&A recovery wording and actions, PillComposer above slot |
| `r6fix-pinmap`, `1e019b87d3adbccec20d111513c3821ff98d0333` | Read-only approximate map area, map accessibility and attribution |
| Dirty `r6fix-izmene`, base `620f8b74` | Agreement changes presentation, fixed footer, existing workspace counterpart name decoding, tests |

The `r6fix-izmene` tracked patch was saved before applying it with three-way checks. SHA256:
`fa4f76e0b9391bd01b58375d452a2a9440574d869d94689f2cb4456cd7a5985b`.
Its two untracked FlowFooter files were copied explicitly. Claude's uncommitted AGENTS and handoff updates were
also preserved. No unrelated agent checkout, old AI branch, scratch folder or frozen migration was imported.

## Integration changes and review

- Connected all six pending skeleton callers to the intended shape: Q&A thread, agreement facts, publication
  preview (real route and gallery), application face and rating person.
- Added behavioral coverage for counterpart name decoding for both roles and malformed/missing names. This reads
  fields already returned by the existing agreement workspace; no RPC arguments, command or recovery guards change.
- Independent code review found map links had only 24 dp real targets despite a surrounding 56 dp band. The links
  now each have 48 dp minimum height in a wrapping row below the map. The previous test was corrected.
- The same review caught recovery text falsely suggesting the server had not received a question even when its
  classification was READY/PROCESSING. The text now says the final outcome is unconfirmed; existing recovery tests
  cover both acknowledged states without changing replay/cancellation logic.

## Verification

- Locked `npm ci`: successful; no dependency changes.
- TypeScript after final source edits: exit 0.
- Initial full Jest: 305 suites, 5,921 tests passed. It overlapped the last attribution/copy edits, so it is
  diagnostic only. A final full run on the settled source is required and recorded in the receipt.
- The initial Jest run warned that a worker did not exit gracefully. A passing exit code is not proof of clean
  timer teardown; the final result records whether this warning repeats.
- `git diff --check`: clean. Frozen SQL inventory: 147 files, unchanged. No files under Supabase, workflows or
  dependency manifests changed relative to the remote baseline.
- Final settled-source Jest: **305 suites / 5,921 tests passed**, exit 0, 106.834 seconds. The worker teardown warning
  repeated; no suite or assertion failed. This package does not claim to resolve pre-existing test timer cleanup.
- Build, matched CI proofs and exact-build emulator evidence: pending at integration commit; see `RECEIPT.json`
  and the completion update below when available. Gallery fixtures do not prove real task/Agreement writes.

## Still separate work

The remaining publication review/place/photo/discovery findings, removal of place checkboxes and current-location
sharing, Nearby with approved expo-location, and the rating-comment candidate are not implemented by this recovery.
The whole-app sweep remains an open worklist, not a list of completed fixes. Payments remain with the other session.
Device acceptance, TalkBack and real end-to-end write journeys are separate from unit tests and gallery screenshots.
