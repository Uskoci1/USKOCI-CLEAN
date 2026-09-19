# PKG-023j: bounded Home attention

Date: 2026-09-19. Owner authorization: design, implement, prove in disposable CI, read-only canonical DEV preflight. **Applying to canonical DEV requires a separate explicit owner decision.** No client switches to this absent RPC in this packet.

**Latest status, 2026-09-20 local:** the owner gave that separate pkg023j-only approval, conditional on verified private preconditions. The exact candidate was applied successfully as `20260919221214_dev_alpha_pkg023j_home_attention`; canonical DEV is now 165 rows. The client is not wired yet. The initial candidate text and its historical approval comments are preserved byte-for-byte; the sections below retain the preparation evidence.

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

The connector role returned PostgreSQL 42501 separately for `private.retention_ai_source_ready()` and `private.closure_source_digest_v5()`. This is an **unverified preflight**, not a failed certificate and not a passed check. No privilege escalation, grant or wrapper was attempted. Both checks require authorized verification before any future application approval is acted upon. The candidate additionally requires both ready checks inside its installation transaction.

## Executed proof receipt (2026-09-20 local / 2026-09-19 UTC)

- Initial proof PASS: https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35471929743 at aa180c1fc15b68e4de21b162d0490cdab4ecb7c3.
- Final, stricter proof PASS: https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35472123196 at 40442c0ce01e7a3f0d163fcdbbc6a4cc538274fb. Eight sections pass, including individual counts, subject references and exact sort instants. The expected pre-install failure and single-function-only surface difference were inspected in downloaded artifacts.
- Exact candidate SHA-256: `7d0cf923c94552f790f72ff16f8be05597e0101245ada4efccee6285a285a9b5`; normalized function-body MD5: `7371d4cddcebead2cb86d8f795d2ee01`.
- PRE-P4 integrity PASS on that proof commit: https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35472125706.
- Local TypeScript exit 0, source migration integrity PASS (147), diff whitespace check PASS. The earlier client packet's 232 suites / 4,461 tests remains a separate working-tree proof; no new client source was edited in this server packet.
- Fresh canonical read-only recheck: ledger 164, candidate absent, six predecessor pins match, client private-schema usage false. Both private certification reads denied as described above.
- The pre-existing broad PKG-023 workflow also automatically ran its historical disposable proof, including the old pkg023c test. It did not reach canonical DEV, regenerate pkg023c or authorize its deployment. Its success is not used as this candidate's proof.

At the end of that preparation packet canonical DEV was untouched and separate approval was requested. The owner then explicitly approved only pkg023j with confirmed preconditions.

## Approved canonical DEV application

The migration tool executed the **unchanged, hash-verified candidate** in its authorized context. The candidate asserts retention readiness and bound closure source **before creating the function**, then checks readiness/binding and unchanged digest again before commit. A false predicate would abort the transaction. The tool returned success; the earlier separately denied SELECT calls remain recorded as denied, not retrospectively successful. No private grants, role switch, helper wrapper, candidate rewrite or extra migration was used to obtain this evidence.

Readback: ledger 165; version `20260919221214`; name `dev_alpha_pkg023j_home_attention`; one recorded statement, 8,912 characters and SHA-256 `7d0cf923c94552f790f72ff16f8be05597e0101245ada4efccee6285a285a9b5`; installed function MD5 `7371d4cddcebead2cb86d8f795d2ee01`; SECURITY DEFINER, STABLE, fixed `pg_catalog`; authenticated execute true, anon/service_role execute false, authenticated private-schema USAGE false.

Exact recorded SQL and the application receipt are in `supabase/operations/dev-alpha/ledger/20260919221214_dev_alpha_pkg023j_home_attention.sql` and its `.receipt.json` sibling. The old LEDGER_MANIFEST.json is an older 160-row snapshot; it is not silently rewritten as current. The source147 inventory is unchanged. No DEV test identity, paid provider call, production resource, pkg023c or price_basis activation occurred.

Client paging, per-row pending-command reconciliation, bounded upcoming-Agreement ordering, and final Home UI remain follow-up work; installing this RPC alone does not remove existing client scans. No further approval is needed for this completed application. Any different future DEV migration still needs its own explicit approval.
