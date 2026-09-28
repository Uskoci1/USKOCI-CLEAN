# Round47 — remove unnecessary P6 work with paired response and timing proof

## Problem / evidence

Round46 measured SQL p95 PAGE 1019.168ms, MAP 1065.423ms and PLACES 1202.442ms on 4004 total / 3000 matching synthetic Needs. Those three cases failed the 1000ms SQL screening ceiling; EXACT was 2.655ms. Internal plans showed base projection across all 4004 rows, repeated map representative Unique nodes (160 loops) and locality representative Unique nodes (53 loops). No JIT or storage-I/O cause was inferred: costs, buffers and loops were measured, while per-node timing was deliberately off.

## Product / contract / implementation

A guarded source-only delta, supabase/candidates/p6_discovery_cost_v2.sql, layers on the exact original p6_discovery_all.sql. It changes only three newly proposed P6 function bodies after strict predecessor hashes and exact replacement checks. It does not edit covered_slots, closure/world guards, ACL/RLS, certificate definitions or live packages. Public response shapes, sorting, cursors, counts and selection-time authority remain unchanged.

Capacity is evaluated over the whole qualifying set only when a multi-person filter actually needs it; TaskCard/EXACT projection still uses authoritative coverage, once per returned row. Date work is skipped only for MAP/PLACES with no date filter, never for PAGE availability. Null/empty and remote locality fast paths avoid unused normalization. Map/locality representatives are materialized once, and a facet's normalized key is calculated once rather than repeatedly. This is not permission to omit facts or trust a cached selection result.

## Exact proof and measured result

Source 1af01119ffbc6aba75ce82c0c85405a0982cc58f; Actions run 36454436800. All 13 SQL groups PASS, including the original 11 correctness/authorization/rollback groups, helper/filter parity and 240 paired timed calls. The original candidate is cloned only by a documented public P6 helper/RPC namespace rename; its helper bodies stay original, so the comparison is not an old RPC accidentally using optimized helpers. Both variants query the same transaction, synthetic actors, data and authorization.

The additional helper matrix covers 300 area/city/remote combinations and 10 unquote values. Filter comparisons cover people, date and remote/on-site contexts. Two selected-slot fixtures verify that a late EXACT projection keeps real nonzero coverage; they are math fixtures, not marketplace selection E2E. Every warmup and timed response is compared against the original full payload, removing only asOf/counts.observedAt and retaining a common legitimate anchor. No prices, IDs, counts, permissions or cursor fields are dropped from comparison.

| Mode | Before + after samples | Before p95 ms | After p95 ms | After max ms | After SQL <=1000ms |
| --- | --- | --- | --- | --- | --- |
| PAGE | 30 + 30 | 1310.154 | 1188.091 | 1189.49 | FAIL |
| MAP | 30 + 30 | 1340.733 | 1147.719 | 1149.409 | FAIL |
| PLACES | 30 + 30 | 1516.751 | 1218.733 | 1219.961 | FAIL |
| EXACT_PUBLIC | 30 + 30 | 3.046 | 3.145 | 3.305 | PASS |

Screening FAIL; at least 10% p95 reduction in all three collection modes: NO. These are nearest-rank, single-connection, warm SQL measurements, with five warmups per case/variant and alternating before/after order. Environment: 17.6, Linux-6.17.0-1022-azure-x86_64-with-glibc2.39, 4 reported CPUs. No HTTP transfer, concurrent traffic, native render, cold-cache or 30000-scale claim is made. Optimized nested ANALYZE BUFFERS plans, original/optimized samples and exact hashes are retained under round47/.

## Scoped current-column diagnostic

Fresh read-only DEV column hashes at 2026-09-28T16:30:02.635064Z cover 41 Need columns. Isolated pre045b comparison has 41 columns and 1 per-column difference(s). Read the receipt and column-detail artifact rather than treating an aggregate hash mismatch as a known schema cause. All live definitions remain unchanged. The existing conditional PKG045b compatible-device rollout gate remains; no new broad approval is requested or exercised.

## Backend / rollback / limits / control

No canonical DEV apply, provider or device action, native dependency, money/flag change or production reader wiring. Original before-apply function/policy/ACL/certificate checks and transaction rollback pass; disposable stack teardown without backup passes. The original Round44 and Round45 receipts remain exact historical evidence; actual Auth/PostgREST must be refreshed against the optimized candidate before rollout. This package is not native, latest-ledger or store acceptance.

Existing B04/B05 control rows are reconciled and node scripts/control/osvezi.mjs generates their views. Hosted publication is not established. P6 remains OPEN. Next work: resolve the precise column comparison, refresh actual HTTP/negative-auth proof for the optimized candidate, cover sparse/dense and larger-volume/capacity-filter timing, then paging owner/stale fences/map/locality adapters and exact native acceptance. Apply still requires fresh canonical preconditions and the existing owner/certificate procedure.
