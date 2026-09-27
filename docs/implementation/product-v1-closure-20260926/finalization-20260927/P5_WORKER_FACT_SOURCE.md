# P5 worker facts — bounded source round

Date: 2026-09-27. Baseline: `a1fe01e4` plus the shared finalization working tree.
Status: SOURCE ONLY / UNVERIFIED. No tests, types, build, device, paid AI calls,
server reads/writes, Edge deployment, dependency change or taxonomy promotion ran.

## Concrete client correction

`src/ui/workerProfile/WorkerAiPresentation.tsx:127` now applies ASCII-space
trimming to each manually entered capability line before `capabilityTerms`.
Previously it used JavaScript `String.trim()`, which also removes Unicode
whitespace. All four lists are submitted even when a person changes only another
field, so an existing valid term such as `\u00A0Prenos\u00A0` silently became
`Prenos` during an unrelated manual correction. The corrected parser preserves
the authored non-breaking spaces, as the existing canonical validator does.

Source evidence:

- `src/lib/capabilityTerms.ts:1` documents spelling, case, order and duplicate
  preservation; its ASCII-space trim is at line 10.
- `src/ui/workerProfile/WorkerProfilePresentation.tsx:138` already uses the same
  ASCII trim when adding an ordinary worker-profile term.
- `supabase/migrations/20260912220506_clean_v5_owned_worker_profile.sql:111`
  accepts at most 50 strings, checks their PostgreSQL `btrim` length and rejects
  control characters, then preserves the submitted list. Non-breaking spaces
  are not ASCII spaces or control characters.
- `src/ui/workerProfile/WorkerAiPresentation.tsx:132` retains the same proposal
  patch fields and the existing final-review save flow. No visible layout,
  labels, account guard, action callback or server contract changed.

The existing one-item-per-line editor, ASCII blank-line omission, list ordering,
duplicates and canonical 50-item / 500-character bounds remain in place. This
correction does not reinterpret free text as a category, credential or verified
qualification.

## Actual current extraction and admission

- Ordinary manual profile drafts clone the current resource arrays and build
  changes through `capabilityTerms` (`src/ui/workerProfile/workerProfileDraft.ts:8`,
  `:26`). The owned profile writer revalidates those arrays before the existing
  account/profile-filtered write (`src/data/workerProfileClientService.ts:68`,
  `:114`). Location and availability retain their separate existing writers.
- The worker interview proposes only allowed worker fields. Its structured
  patch schema is at `supabase/functions/uskoci-worker-interview/index.ts:58`;
  the explicit-fact/no-invented-license instruction is at line 78. Resource
  arrays represent the complete desired list (line 81). A finish-only turn
  receives an empty patch (line 185). These are source constraints, not evidence
  of model quality on a fresh paid run.
- Client snapshot admission validates all four capability arrays through the
  same validator (`src/data/workerAiClientService.ts:59`). Manual corrections
  call the existing revision-bound proposal patch (line 155). The route also
  retains current account/focus/panel guards and disables concurrent edits
  (`src/app/(app)/profil/razgovor.tsx:106`, `:181`, `:219`).
- Proposal mutation remains distinct from canonical saving. The server patch
  checks the expected revision and original profile hash (migration above,
  line 351); review preparation and saving bind the displayed candidate to the
  immutable review (`:369`, `:385`, `:413`). The client saves the admitted
  review ID and displayed digest (`src/data/workerAiClientService.ts:159`).

## Remaining scope and later checks

This is one lexical parity correction. It does not implement or prove the
PLAN's versioned taxonomy nodes, confidence, candidate grouping/promotion,
matching hard eligibility, ranking quality or scale behavior. Current worker
resource lists remain authored strings. Server/taxonomy changes and new visible
flows need a separate concrete proposal and the corresponding owner approval.

When checks are authorized, cover an unrelated-field correction with preserved
Unicode-edge whitespace in each of the four lists; an explicitly edited list;
ASCII surrounding spaces and blank lines; duplicate/order preservation; and
the existing item/count boundaries. Then verify the displayed proposal,
immutable final review and canonical readback on the exact client. No execution
or device acceptance is claimed by this source report.
