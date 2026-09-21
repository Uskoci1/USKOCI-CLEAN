# PKG-034 — closure preparation uses the executor's blockers

Status: **candidate written; not yet proven or applied**.

Deep-read 12.10: the preparation receipt omits worker-profile AI and Q&A work. Full live bodies also show
it misses unsettled storage/photo work and treats every scoped hold as a hard block, although the approved
erasure executor deliberately distinguishes scoped evidence from a whole-account hold.

The candidate changes only private.account_closure_preparation(uuid). It calls the unchanged certified
closure_erasure_hard_blockers_v5 and projects those codes into the five-code preparation contract already
accepted by installed clients. Storage/unknown hard blockers become PENDING_WORKFLOW at this legacy stage;
execution review retains the exact reasons. Multiple processing conditions yield one code.
A scoped hold alone remains an exception for execution review, not a fabricated hard blocker.

The legacy preparation flags and reason CLOSURE_EXECUTION_NOT_READY are retained for compatibility.
Preparation never authorizes erasure: the dialog already uses the certified execution review to decide
whether to offer the explicit final confirmation. This package therefore fixes **12.10 only**. The broader
7.41 readiness-contract debt and 8.18 recovery without a local START journal remain open. That recovery
requires a separate, proved change to the certified reader and a fresh owner decision before any rebind.

No existing row, erasure function, guard, table, trigger, privilege or certificate is changed.
The candidate checks the measured predecessor body and blocker-authority pins, patches one exact anchor,
checks the resulting body and privileges, and asserts unchanged live certificate and readiness before commit.

## Proof

The workflow reconstructs source147 plus all 42 recorded DEV changes through PKG-033, using the exact
recorded candidate hashes. The changed predecessor and both blocker authorities must match DEV.
All synthetic accounts, sessions and workload rows exist only on the disposable database inside transactions
that roll back. No hosted key, real account, provider call or device is used.

Before: reproduce disagreement for worker AI, Q&A, scoped hold, media upload and Agreement photo upload.
Apply: tampered predecessor refusal without changes; one application; repeated application refusal;
exactly one function body changes; certificate stays identical and ready.
After: prepare and review agree about blockers for idle, each job, whole/scoped holds, combined conditions,
and work owned by another account. Blocked START refuses, receipts replay exactly, changed request input
and another account are rejected, and legacy preparation shape is retained.

## Application gate

Only after a successful, downloaded and inspected CI proof: fresh DEV pins/ledger preflight, exact committed
candidate text through apply_migration, ledger SHA/body/authority verification and receipt. Standing owner
authorization covers this ordinary fix if the proof establishes no certificate move.
