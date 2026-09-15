# USKOČI Execution Ledger

This directory is the machine-readable execution/proof journal for the V19+ implementation plan.

## Authority model

The ledger does **not** replace product canon, GAP definitions, target UX, or forensic annexes. It records what actually happened during implementation so those views can derive current status without hand-editing multiple places.

- `events.jsonl` is append-only execution history.
- `current-package-state.json` and `.csv` are generated views.
- `scripts/control/execution-ledger.mjs` validates the Universal DONE_VERIFIED rule and regenerates the views.
- CI runs the generator in `--check` mode and fails if the derived views are stale or an event violates the schema/gate.

## Required package-close evidence

A package may be `DONE_VERIFIED` only when the closing verification event contains:

1. exact 40-hex candidate commit;
2. original reproduced problem -> PASS;
3. legitimate positive scenario -> PASS;
4. relevant security/replay/account/privacy guard proof -> PASS, or explicit N/A with a reason;
5. evidence IDs / CI references bound to that candidate;
6. relevant source paths used for freshness checks.

A green diff, merge, TypeScript run or test suite alone is not completion.

## Freshness

For a verified package the generator compares `candidateCommit..HEAD` and checks whether any declared `relevantPaths` changed. A hit marks the package `REVERIFY_REQUIRED` in the generated view. This never silently rewrites historical evidence; the old verification event stays immutable.

## How an agent records work

After each meaningful implementation/proof step append one JSON object to `events.jsonl`. Do not rewrite an older event to make history look cleaner. Corrections are new events referencing the superseded event.

Minimum package lifecycle:

`STARTED -> IMPLEMENTED -> VERIFIED` or `BLOCKED/REVERIFY_REQUIRED`.

Retroactive reconstruction is allowed only from exact GitHub commits/PRs/CI logs/artifacts/source. Unknown or unbound proof must be recorded as `UNVERIFIED`, not invented.
