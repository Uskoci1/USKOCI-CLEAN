# USKOČI Execution Ledger contract

## Authority and purpose

`EXECUTION_LEDGER.jsonl` is the append-only implementation/proof history after the V19 control snapshot. It is **not** a new product master, does not replace Master Control / forensic annexes / Target Product / Implementation Plan, and does not rewrite V19. A future V20 control may derive current package, GAP, evidence, dashboard, dependency, proof-freshness and cleanup status from this ledger plus the existing forensic matrices.

The ledger is also **not a deployment authorization**. SQL, Edge, provider, device, DEV/live and production gates remain owned by the existing dependency plan.

## Append-only rule

New implementation/proof facts are appended as new JSONL events. Do not silently rewrite an old event to make history look green. If an earlier statement becomes stale, append a new event with `STALE`, `REVERIFY_REQUIRED`, `REGRESSION_DETECTED` or another accurate status and point to the invalidated evidence.

A package may have multiple history events and later receipts. Consumers determine current state from the latest applicable receipt/event, while retaining the complete history.

## Allowed package statuses

`NOT_STARTED`, `PLANNED`, `IN_PROGRESS`, `IMPLEMENTED`, `IMPLEMENTED_PENDING_VERIFICATION`, `DONE_UNVERIFIED`, `DONE_VERIFIED`, `BLOCKED`, `STALE`, `REVERIFY_REQUIRED`, `REGRESSION_DETECTED`, `MISSING_PROOF`, `SUPERSEDED`.

Never use an unexplained generic `DONE`.

## Required receipt fields

Every `PACKAGE_RECEIPT` records at least:

- package ID/name and GAP IDs;
- exact goal and start status;
- branch, PR, base SHA, branch head SHA, exact tested candidate SHA and tree SHA;
- work window;
- changed files and touched functions/services/screens/RPC/Edge/SQL;
- original repro and PRE-FIX result;
- POST-FIX result of the same problem;
- legitimate positive scenario and result;
- security, replay/idempotency, account/session and privacy guards (`PASS` or justified `N/A` when not relevant);
- TypeScript, build, selected tests and full regression where applicable;
- Actions run/conclusion and artifacts/hashes where available;
- migration/live DB/Edge/device/provider proof or an explicit justified `N/A`;
- resolved and still-open items;
- final status and explicit reason when not `DONE_VERIFIED`;
- proof freshness / invalidation reason;
- next safe step;
- verifiable evidence references.

## Universal DONE_VERIFIED rule

`DONE_VERIFIED` is allowed only when all relevant conditions are simultaneously supported on the exact candidate:

1. the original defect has a verifiable PRE-FIX witness and the same repro is PASS after the fix;
2. at least one legitimate/positive scenario is PASS;
3. relevant security, replay/idempotency, account/session and privacy contracts are preserved, or the non-applicable guard is explicitly `N/A` with a reason;
4. completion evidence is bound to the exact `candidateSha` / source tree. A green source commit, PR, mergeability, merge, TypeScript, selected test, full suite or CI alone is insufficient.

Retroactive source reconstruction may record a deterministic PRE-FIX `FAIL` from exact Git source/diff when there is no historical execution run, but it must say that the old test was not executed. Never invent an old PASS or a device/live/provider result.

## Proof freshness

A later change to relevant source invalidates or requires reassessment of the affected proof. Append `STALE` or `REVERIFY_REQUIRED` until the relevant repro/positive/guard evidence is rerun or explicitly re-attested on the new candidate. An unrelated documentation/control-plane change does not automatically invalidate a runtime package, but that non-impact decision must be explicit when used.

## Cleanup

Replacement existence alone never authorizes deletion. `RETIREMENT_ELIGIBLE` requires a fresh `DONE_VERIFIED` replacement, parity proof, no active callers, no dynamic/build/test dependency, and current proof freshness. Until then use existing classifications such as `LEGACY_RETIRE`, `DELETE_AFTER_PARITY`, `HISTORICAL_ONLY` or `KEEP_DEPENDENCY`.

## Current bootstrap boundary

The first ledger bootstrap reconstructs only package execution that can be supported from GitHub commits, PR #102, Actions runs/logs, tests and exact source. Missing evidence stays missing. V19 remains an immutable historical snapshot.