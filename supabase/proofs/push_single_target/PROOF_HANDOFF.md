# Executable disposable proof handoff

Status: prepared, JavaScript syntax checked, **not executed against any database**. No provider call, CI dispatch, live write or canonical edit was made. Do not label this package DEV-ready.

Copy the package files (except the `.github` subtree) to `supabase/proofs/push_single_target/`; copy the supplied workflow to `.github/workflows/push-single-target-proof.yml`. The nested Edge file is deliberately a proof candidate, not an automatic replacement of the deployed Edge source. Root reviews, commits and dispatches. Existing dependencies and replay scripts are reused; no new dependency is added.

The workflow reconstructs the established live79 → source147 → PKG050 → B3b → P4/B3c → B24 → Voice B1 disposable chain. Historical self-restoring P4 proof runs and unrelated EX04/read proofs are omitted. The candidate installer still requires **all eight exact predecessor pins**: no mismatch is relaxed to make replay green. This chain is not a claim of complete current DEV parity. It may identify a missing prerequisite; that failure must be examined rather than recertified away.

## Certificate integration resolved in source

The existing schema digest covers columns/constraints/triggers, but not free-standing indexes. Authorization uniqueness therefore uses a real UUID column and UNIQUE constraint, not an uncovered expression index. The source digest and erasure-program metadata rosters gain all nine relevant functions: three existing transport functions, session/suppression helpers, and four new admission/claim/revoke functions. Merely changing the stored certificate hashes was insufficient.

`certificate-proof.mjs` builds one transaction from the guarded installer and the current disposable predecessor: it locks execution/certificate tables, refuses an executing closure, verifies both complete certificate rows and readiness, confirms the schema change closes readiness, extends the rosters, updates only the two SHA fields and readiness literal, then verifies the new binding. Before admission, the proof restores the complete predecessor and reapplies deterministically. Dataset and export catalog values must stay exactly equal. Body and ACL mutations must make readiness false and binding null inside rolled-back transactions.

This is a **loopback-only proof adapter**, not a DEV recertification script. A DEV package still needs an immutable current predecessor/metadata preflight, reviewed certificate delta, exact generated candidate/revert, drain/deployment order and readback. The proof does not bypass this by permitting a generic live rebinding utility.

## Executable coverage

- Six isolated actual-Edge cases: both default-off actions have zero IO; service authorization and exact input shape; SEND-only/RECEIPT-only routing; consumed claim; one throttle completion without retry.
- Real disposable Auth, real agreement/message RPCs, two session-bound synthetic devices.
- Concurrent claims produce one lease; replayed admission is existing; lost claim cannot regain a lease; repeated begin cannot reveal the token twice.
- Unrelated delivery/attempt/device hashes and message/in-app read state remain unchanged during targeted send. Actual Edge is exercised across two independent VM instances with Expo intercepted.
- SEND throttle and receipt rate error become terminal; ambiguous send stays UNKNOWN; no second SEND claim.
- Revocation and expired never-started lease remain consumed; generic SEND/RECEIPT claims cannot mutate admitted rows even inside a rolled-back transaction.
- Actual observed SQL lock wait for revoke-before-begin and device revision change before token exposure.
- Non-service RPC denial, certificate body/ACL drift, exact revert before admission, explicit revert refusal after durable admissions.

## Remaining acceptance boundaries

None of these assertions has a PASS receipt yet. Node `--check` passed for the four JS modules; that is syntax only. The candidate installer/SQL and replay must still run in the disposable workflow. Additional cases worth adding before DEV activation include wrong admission role/session/consent/closure/block, active session revocation after claim, token rotation under its real writer, admission deadline crossing while begin waits, ordinary non-target transport regression, and full account-closure execution with admitted rows. Current ownership/delete helpers are pinned but source inspection is not erasure execution. A phone/provider test remains a separate authorized exact-target step; no delivery/tap acceptance is implied.

Review correction: independent review found missing outer semicolons on raw `pg_get_functiondef` definitions. Both build-generated installer/revert and certificate-generated definition statements are now terminated. Function body hashes are unchanged by this packaging fix.
