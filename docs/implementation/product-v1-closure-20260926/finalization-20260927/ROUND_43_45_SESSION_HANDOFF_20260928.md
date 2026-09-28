# Round43–45 — verified implementation checkpoint and preserved failure history

This is an evidence archival addendum, not a new READY claim, new audit, live apply or release candidate. Repository: Uskoci1/USKOCI-CLEAN. Canonical branch: work/uskoci-ui-unification-20260924. The verified branch HEAD immediately before this docs-only archival commit is f790f04a2e58b312010590d70c6dba5fce05997f. Always resolve a fresh branch HEAD before continuing; never reset to this recorded SHA.

## Exact completed packages

| Package | Tested source | Verified Actions run | Evidence scope |
| --- | --- | --- | --- |
| Round43 quarantined spatial decoder guards | c43c078188633bf022e13489bc9eb5379e142457 | 36439653581 | Eight RED-before assertion failures, no runtime-suite error; TypeScript PASS; full Jest 347 suites / 7299 tests PASS. |
| Round44 standalone PAGE / EXACT_PUBLIC / MAP / PLACES candidate | 7b75631ba0504c3ca9d6a0a43887bb88180572c9 | 36443089843 | Eleven disposable SQL groups PASS on historical source147 + PKG045b; no current-DEV compatibility or cost claim. |
| Round45 real local Auth / PostgREST / existing client decoders | bf4008d6757a92ef745bfac00907898f5e8760c6 | 36444393395 | Eleven groups PASS, three distinct password sessions, 47 local HTTP requests, negative authorization and privacy-column/row checks. |

Read ROUND_43_P6_SPATIAL_GUARDS.md and ROUND_43_P6_SPATIAL_CHECKS.json, ROUND_44_P6_FOUR_MODE_SQL.md and ROUND_44_P6_FOUR_MODE_CHECKS.json, and ROUND_45_P6_HTTP_BOUNDARY.md and ROUND_45_P6_HTTP_CHECKS.json. Successful evidence/control pushes were independently read back at ec5d6212e44e24d2eec0655d8e1a334532c82bc0, d75867e57aa2249e95f39a69e1c11d6e5dbb6b3c and f790f04a2e58b312010590d70c6dba5fce05997f respectively. This is stronger than merely recording a queued workflow.

Round43 refuses impossible map counts, duplicate TASK UUIDs under different keys, impossible locality totals, unrelated PLACES continuation tuples and empty continuing pages. It does not change the production reader or visual surfaces. The workflow phase labelled focused selected all 347 suites with the installed Jest CLI, as its receipt shows; it is not evidence of a narrower separately isolated suite selection. The full regression result remains 347 suites / 7299 tests, not twice that number. Use the installed Jest version's supported exact-path option for future focused checks.

Round44's standalone candidate is supabase/candidates/p6_discovery_all.sql, SHA256 1d7edb92f85cb84099f0bc02a3b8edebea40907ec18fa861c14408bcf10f6e2e. Its invoker/column-ACL/capacity authority is preserved. MAP proves complete public-point coverage with at most 256 grid buckets, not arbitrary truncation. Functional fixtures include 0, 1, 100, 1000 and 3000 tasks, 1500 coincident points, sparse points, wrapped bounds, world edges and point-free/remote tasks. PLACES proves complete count/text/key traversal. These are bounded-output and correctness tests, not a claim of bounded total database work, concurrent load or production latency.

Round45 exercises the same candidate bytes through local GoTrue-issued user sessions and PostgREST, then passes actual responses through the existing strict TypeScript decoders. Anonymous/malformed requests are refused; nonpublic tasks and sensitive addresses do not leak. The service role is used only for disposable Auth fixture creation, not user marketplace reads. Candidate functions are removed, pre-existing authority fingerprints match, and stack teardown without backup passed. All tested identities and data remain confined to that disposable stack. This is not N02 email-delivery, app session A→B→A, real-device marketplace E2E, or product account-deletion proof.

## Original failed receipts retained unchanged

The two JSON files added alongside this document are exact bytes extracted from the original CI artifacts. A later passing run does not rewrite those attempts into successes. Their generated source commits were local to the failed runner; the canonical branch did not receive those failed candidate commits.

| Failed run | Failure | Original artifact | Original ZIP SHA256 | Persisted JSON SHA256 |
| --- | --- | --- | --- | --- |
| 36441177762 | SQLSTATE 23502, proof line 236: null approximate_city fixture violated the existing NOT NULL column | 10978307282 | 973abde2c31a948e26c7da561c0b2e8ed9757e70e89fa2fd3f89d70bd7704ff9 | f735d24b19d0ede0a052f120bf9dca717e93ed8bf42048540e78ceb6fa433d90 |
| 36441957693 | SQLSTATE 57014, proof line 325: the aggregate PLACES traversal/oracle DO exceeded the unchanged statement timeout | 10978917356 | dc00698577cea2111d4c57d8d33c117e26a26317a61e3d5a0a1ba0a08cf24908 | 3f330c919e7b0d4c27349e70477fc73d5207cecc9b39582220c62f876d3c4c19 |

Files: ROUND_44_SQL_FAIL_36441177762.json and ROUND_44_SQL_FAIL_36441957693.json. The first failed fixture used null for an unnamed city; the repair supplied an empty string without changing the schema. The second attempt had already passed both MAP groups. Its repair precomputed the independent fixture-count oracle once and executed each PLACES page in a separate psql statement, preserving all comparisons, terminal-state checks and the original 60-second per-statement timeout. No candidate SQL bytes changed between these attempts. This isolates the request boundary; it is not a demonstrated server optimization. No numerical latency or percentile claim is made from these runs.

## Control and protected state

The existing node scripts/control/osvezi.mjs generator ran successfully within each completed package. The B04/B05 source rows and generated docs/control/stanje.json, docs/control/FINALIZATION_MATRIX.md and docs/control/out/tabla.html were committed with their package evidence. This addendum changes only evidence files and does not manually regenerate or relabel control output. Hosted control publication remains unverified.

No canonical Supabase DEV package, new certificate definition, ledger row, Edge deployment, external provider, exact push flag, native dependency, monetization or destructive real-user operation was applied. The read-only DEV metadata observation at 2026-09-28T14:38:29.918002Z found rpc_discovery_v1(jsonb) absent, the expected covered_slots normalized body MD5 cbeb8f2a3da7d08965ef0386cfc437ba, and the required Serbian ICU collation present. That observation is not fresh apply authorization.

The production Discovery remains on its existing reader. TaskCard/Peek and the logical FULL-return/native-remount correction are untouched. The rejected 2b2cf4d7 experiment and deferred privacy branches were not reintroduced. No APK/AAB/IPA was built, no emulator or physical Android/iOS device was used, and no prior binary's acceptance is transferred to this source.

## Exact next engineering work — P6 remains OPEN

First compare the candidate's dependencies, schema, ACL/RLS and certificate-related preconditions against the current canonical DEV metadata and reproduce the relevant current predecessor on a disposable stack. The existing historical PKG045b pass is not a substitute. Then collect internal EXPLAIN ANALYZE BUFFERS and measured request timings with at least 30 samples per claimed percentile across sparse/dense/skewed datasets; define and evaluate actual performance budgets rather than claiming 3000-row functional success means production scale.

After server/contract/cost gates, implement and prove paging ownership, stale-request fencing and map/locality adapters while keeping the production switch off until all required gates pass. Native large-data/memory/FULL-return verification needs a recorded exact Android/iOS candidate and devices. These remaining engineering items are not waiting only for owner approval. Preparation can continue without live apply; applying a new canonical package still requires the separate authorization/certificate procedure.

Voice B1/B2, external exact push/email/AI/matching provider evidence, account/safety/export/closure, final whole-app privacy/legal, release builds and store acceptance are not closed by these P6 packages. Their latest canonical rows remain authoritative.

The Round43 repair and Round44 builder workflows deliberately pin a predecessor and refuse duplicate application; do not blindly rerun a historical one-shot builder over files that now exist. Round45's evidence writer also refuses overwriting an existing round receipt. For a new proof iteration, preserve original receipts, bind the new exact source and use an explicit reviewable refresh package rather than bypassing drift checks.

No work is claimed after this checkpoint. The next session must read the latest branch, AGENTS, runbook and current tracker rather than restart the product or infer release readiness from this document.
