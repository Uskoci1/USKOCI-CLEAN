# Round46 — current read-dependency comparison and measured P6 query cost

## Problem / user impact / current baseline

Round44/45 covered an isolated historical target, not today's DEV. A fresh read-only canonical observation at 2026-09-28T16:00:41.850113Z and follow-up 16:01:15.571531Z confirm ledger210, PostgreSQL17.6, and whole-table/protected-column SELECT privileges still present for authenticated. PKG045b is not in the live ledger. This matches the existing documented conditional compatible-device rollout gate; it is not a new approval request or a claim that every row is exposed to every account. No private user rows were read.

The new harness replays historical042a/045a, compares11 relevant function bodies and columns/policies/indexes of7 read-dependency tables with those observations, then replays the already-frozen045b only on the disposable stack. Comparison: DIFFERENCES PRESENT; inspect the receipt before any current-baseline claim. This is scoped metadata, not an attestation of all current210 packages, certificates, constraints, consumer devices or runtime data.

## Implementation / exact checks

Source 2b04f863b78e7182657600dd1dbfe8534818faa4; Actions run36451155987. New p6_current_cost.py, p6_cost_probe.sql, p6_dependency_snapshot.sql and typed evidence parser extend the existing11-group SQL proof without changing the candidate or original assertions. Candidate SHA256 remains1d7edb92f85cb84099f0bc02a3b8edebea40907ec18fa861c14408bcf10f6e2e. Ten parser regressions reject insufficient/duplicate samples, non-finite timings, wrapper-only EXPLAIN and unsafe payload fields.

All11 original SQL groups passed with120 additional measured calls:30 per mode after5 unmeasured warmups. Each call is a separate top-level statement under the original60-second timeout; the earlier aggregate-loop timeout is not hidden by increasing it. ANALYZE is limited to the disposable fixture tables. Metadata, samples and public-safe nested plan trees are retained under round46/.

## Measurements (milliseconds; nearest-rank percentiles)

| Mode | n | p50 | p95 | max | Max JSON bytes | SQL <=1000ms screening |
| --- | --- | --- | --- | --- | --- | --- |
| PAGE | 30 | 1002.956 | 1019.168 | 1057.298 | 37441 | FAIL |
| MAP | 30 | 1036.242 | 1065.423 | 1072.031 | 29298 | FAIL |
| PLACES | 30 | 1169.005 | 1202.442 | 1203.685 | 1090 | FAIL |
| EXACT_PUBLIC | 30 | 2.372 | 2.655 | 3.161 | 1166 | PASS |

At least one SQL screening case exceeds 1000ms; P6 performance is NOT accepted.

Environment: 17.6, Linux-6.17.0-1022-azure-x86_64-with-glibc2.39, 4 reported CPUs; 4004 total Need rows,3000 matching the skewed spatial fixture. PAGE/MAP use its task filter; PLACES intentionally ignores task text and uses the independent prefix. EXACT targets one original public fixture. Dataset includes1500 coincident points plus sparse and point-free work. Concurrency1; warm cache; SQL-only elapsed time excludes connection creation, HTTP/Auth, network and native rendering. Samples are collected before instrumentation. No cold-cache, percentile over unspecified networks, large-user-count or full-app performance claim is made.

For PAGE/MAP/PLACES, actual nested main-query plans are captured with auto_explain ANALYZE+BUFFERS and per-node TIMING OFF after sampling. The parser requires the candidate's internal WITH base query and real needs scan/row/loop/buffer nodes; SELECT rpc_discovery_v1(...) alone cannot pass. Published projections keep node structure and measurements but omit query text, filter constants, user IDs and output expressions. Query text is hash-bound instead. Official method: https://www.postgresql.org/docs/17/auto-explain.html .

## Backend / privacy / rollback / limits

No live apply, new certificate authorization, provider call, production reader wiring, native dependency or visual change. Historical045b movement remains confined to its disposable replay; all existing authority, policies and grants pass the original unchanged/rollback checks. Stack teardown without backup passed. Actual local Auth/PostgREST belongs to Round45's exact source; this package does not re-label it as new provider or device proof.

## Control / status / next highest-impact work

B04/B05 are updated and the existing generator runs before its views are committed. Hosted publication is not verified. P6 remains OPEN. Current SQL screening outcome: FAIL; optimize only after inspecting retained internal plans. The known live045b condition is a real device rollout boundary, not permission to force its old preconditions or rerun an applied package.

Next: resolve any dependency differences and diagnosed query hot spots in a separate reviewable candidate with semantic before/after proof; then sparse/dense/load budgets, paging ownership/stale fences, map/locality adapters and exact native acceptance. No owner action is needed for safe proof/candidate preparation. Live045b/P6 application, provider and devices retain their separate concrete gates.
