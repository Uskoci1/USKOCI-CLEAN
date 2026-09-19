# PKG-023j: bounded Home attention, candidate only

Date: 2026-09-19. Owner authorization: design, implement, prove in disposable CI, read-only canonical DEV preflight. **Applying to canonical DEV requires a separate explicit owner decision.** No client switches to this absent RPC in this packet.

## Problem and contract

`composeHome()` currently needs complete application and Agreement lists to discover three attention rows and calculate `+N`. `rpc_home_attention()` returns a single JSON document with `schemaVersion: 1`, `asOf`, at most three `items`, and complete `counts`. No input account ID, client clock, offset, or caller-defined limit exists. The identity comes only from `auth.uid()`.

Each item contains `reason`, `subjectId`, `taskId`, `agreementId` (nullable), `applicationId` (nullable), `taskTitle`, `applicationCount` (nullable), and `sortAt` (nullable only when the legacy application has no submission instant). The client owns wording and routing. Stable UI identity is subject plus reason: an Agreement awaiting confirmation with an open problem correctly contributes TWO attention rows.

Priority and predicates reproduce `src/data/homeSnapshot.ts` and `hasNeedAttention()`:

1. `AGREEMENT_CONFIRM_COMPLETION`: effective Agreement state AWAITING_REQUESTER and caller is requester.
2. `AGREEMENT_OPEN_PROBLEM`: effective state CONFIRMED/AWAITING_REQUESTER and an open problem.
3. `APPLICATION_STALE` / `APPLICATION_ATTENTION`: caller's active application has stale state/review flag or the existing server attention flag. The pinned legacy projection currently sets that flag for STALE_REVIEW_REQUIRED and SELECTED; SELECTED is not a Home-active application. Thus the generic attention-only reason is reserved by the contract but is currently unreachable. The proof does not pretend to exercise a nonexistent server state.
4. `TASK_APPLICATIONS`: caller's task is neither draft nor terminal, has remaining slots, and has visible responses.

Agreement attention keeps the existing paged reader's `created_at DESC, id DESC` order. Applications keep the currently used **unpaged** reader's `submitted_at DESC NULLS LAST, id ASC` order, not the different created-at order of the paged application RPC. Tasks use `created_at DESC, id DESC`; the old direct read specifies only created_at, so id merely makes its unspecified tie deterministic. Priority always precedes recency.

Counts: total attention reasons and `attentionMore=max(total-3,0)`; active Agreements and `agreementsMore=max(total-2,0)`; nonterminal owned tasks (including drafts); Home-active applications (excluding SELECTED); their sum and `activitiesMore=max(sum-5,0)`. These are full database counts, not first-page lengths. The payload is bounded; exact totals still require database work proportional to the caller's relevant rows. No constant-time or measured performance claim is made.

## Compatibility and access

This is one additive SECURITY DEFINER function with fixed `pg_catalog` search path, authenticated-only execute, no private-schema usage grant, no account parameter and explicit own-task / own-worker / Agreement-participant conditions. It retains the same Agreement joins as the existing reader, including current version and both profiles. Own applications remain readable on non-public parent tasks, as in the existing definer reader.

The aggregate checks the existing own-account closure fence before returning anything. Its task response count matches the current owner/worker RLS visibility: non-DRAFT responses to own tasks, plus a caller's own response if one exists. Existing domain writers prevent self-application, but this read does not assume that to broaden or narrow visibility. Any future changes to these policies require reviewing this aggregate. Closed/closing accounts fail explicitly; a denied or failed read must never become an empty Home.

**Audit F02 deliberately remains open:** visible responses include withdrawn/expired/rejected responses under today's policies. This packet transfers the exact current predicate; it does not equate `applicationCount` with selectable candidates or silently adopt a new selection rule. Fixing that count must use the canonical candidate eligibility authority in a separate, explicitly described change.

No old RPC is rewritten. No table, column, constraint, trigger, policy, index, erasure program, ledger entry, price basis or public location changes. The candidate checks predecessor body MD5 pins, its own body MD5, grants and unchanged ready closure certificate in the same transaction. An already installed candidate, drift, tampering or invalid closure readiness fails before commit.

## Proof and limitations

Workflow: `.github/workflows/pkg023j-home-attention-proof.yml`. It reuses the existing local live79 reconstruction, replays the recorded source147 history in provenance order, then applies the already installed pkg023a predecessor. This is **source147 + exact pkg023a**, not a full DEV164 environment. Candidate dependency body pins match fresh read-only canonical DEV values. The unrelated pkg023c HOLD candidate is not applied by this workflow.

The proof must fail with `PKG023J_MISSING_AGGREGATE_EXPECTED_BEFORE` before installation. It rejects deliberately incorrect predecessor/body pins and proves rollback, then applies the exact git-bound candidate only locally. Rolled-back synthetic read fixtures cover empty accounts, all task/response states, stale precedence on terminal tasks, remaining coverage, cancelled selections, both Agreement sides, missing versions, execution fallback, duplicate reasons, timestamp ties/nulls, outsider isolation, closure denial, exact grants, and counts larger than a 30-row first page.

The oracle loads the actual pure `composeHome()` / `hasNeedAttention()` using the locked TypeScript package. Legacy server projections provide its facts through a small field adapter. It checks the same selected attention identities and all three `+N` values. The full domain surface before/after may gain exactly one function and lose/change nothing; source ledger remains 147 in this disposable reconstruction. Fixtures use a transaction-local replication setting to stage read states without invoking guarded write journeys; role checks run with normal triggers restored. These tests prove read semantics and SQL-role authorization, **not** real Auth login, HTTP/PostgREST transport, a completed user flow, device UI, concurrency/load performance, or full DEV164 integration.

## Canonical DEV preflight

2026-09-19 read-only check: ledger 164, latest version 20260919184627; aggregate absent. Predecessor body pins were inspected. `authenticated` has no private-schema USAGE. Current owner/worker SELECT policies were inspected.

The connector role returned PostgreSQL 42501 for `private.retention_ai_source_ready()`. This is an **unverified preflight**, not a failed certificate and not a passed check. No privilege escalation, grant or wrapper was attempted. The independent closure digest read must also be recorded before any future application approval is acted upon. The candidate additionally requires both ready checks inside its installation transaction.

CI execution results must be recorded from the actual run; this initial commit does not claim a passing run. Canonical DEV remains untouched. Client paging, per-row pending-command reconciliation, bounded upcoming-Agreement ordering, and final Home UI are follow-up work; adding this RPC alone does not remove existing client scans.
