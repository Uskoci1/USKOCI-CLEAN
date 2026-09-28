# Round49 — same-process repeatability and authorized scan controls

## Problem / decision / exact scope

Round48 improved same-run collection timings, but identical SQL passed the 1000ms ceiling on one runner and failed it on another. Do not select only the faster run. This package changes no candidate or production application behavior: it repeats the exact original+cost_v2+cost_v3 stack with three interleaved measurement blocks on one runner/backend, and adds authorized minimal-scan, locality and coverage controls.

Tested source: b9dd6231132cd51c8bf7fd67b1f50079b50290ec. Actions run: 36476575335. The eleven original SQL groups plus the 720-sample/RLS/payload group PASS. The exact candidate hashes are in ROUND_49_P6_CHECKS.json. Canonical DEV, Edge, certificate-controlled functions, RLS/policies, grants, dependencies, TaskCard/Peek and FULL-return code are unchanged.

## Predeclared method and results (milliseconds)

Eight cases, three blocks, 30 samples per block/case = 720; five warmups per case. Nearest-rank p50/p95/max and response sizes are retained per block; no pooled percentile. Each read is a separate psql statement under the original 60-second timeout. Order reverses across samples to reduce fixed ordering bias. Every read asserts authenticated identity, active RLS and normal trigger mode; every response matches the initial authoritative payload after observation timestamps only are removed. RPC cursors/anchors remain real and frozen for these static fixtures. No filtering, policy or authorization check is disabled to improve timings.

| Case | Block 1 p95 | Block 2 p95 | Block 3 p95 | Worst p95 |
| --- | --- | --- | --- | --- |
| PAGE | 835.928 | 849.902 | 842.543 | 849.902 |
| MAP | 815.386 | 808.684 | 808.296 | 815.386 |
| PLACES | 910.633 | 887.747 | 885.947 | 910.633 |
| EXACT_PUBLIC | 3.803 | 4.463 | 4.195 | 4.463 |
| PAGE_PEOPLE2 | 912.385 | 909.512 | 919.684 | 919.684 |
| SCAN | 716.398 | 695.775 | 703.18 | 716.398 |
| AREA | 759.67 | 748.651 | 754.205 | 759.67 |
| COVERAGE | 777.59 | 782.848 | 776.859 | 782.848 |

All five RPC cases under1000ms in all three blocks: True. All five RPC p95 spreads at most20% within this runner: True. The20% spread is a diagnostic screening rule set before execution, not an owner-approved production target or proof of performance on other machines. Valid evidence PASS is distinct from either screening result and from P6 acceptance.

SCAN counts public eligible IDs with the same unchanged row policies, without P6 text/date/locality/capacity projection. AREA adds public display-locality work; COVERAGE adds the exact existing covered_slots authority using the allowed ID-only composite input. Their worst p95 is respectively 716.398, 759.67, 782.848ms. These observations distinguish an authorized-scan baseline from added projection work; do not subtract timings and call the difference exact RLS cost. PAGE_PEOPLE2 exercises the full-set capacity predicate rather than the people=1 fast path.

Environment: PostgreSQL 17.6; AMD EPYC 9V74 80-Core Processor; 4 reported CPUs; 4004 total Needs /3000 matched. One skewed distribution with1500 coincident points, sparse public points and100 point-free tasks. Warm cache, one connection, no network transfer, device rendering, concurrency or30000-scale acceptance. Source-bound samples and environment are retained in the receipt and round49/. Previous slower runs remain valid historical evidence.

## Authority and safety / applied or not

All synthetic data and P6 helper installation stay in the existing disposable transaction and roll back. Original anonymous/auth-null, private-column, unchanged function/ACL/policy/certificate and rollback assertions are retained. Existing PKG045b is replayed only as the documented historical test target; no new DEV package or approval is exercised. Teardown without backup PASS. This package does not claim a new live, HTTP, provider or native test.

## Owner completion instruction (supersedes automatic phase continuation)

Continue the existing P6 priority only. Do not declare completion from source, SQL, CI or candidate readiness. P6 completion requires stable sufficiently evidenced performance; all four modes; paging owner and stale-response fencing; an actually connected production client; integrated map/list/filters; preserved FULL/pin/Peek/detail/Back with scroll/viewport/selection; large-data and memory/ANR acceptance; any necessary authorized and confirmed server rollout; and exact matching native build evidence.

Only when all applicable conditions are closed, stop and write **P6 ZAVRŠEN**, followed by what closed, final HEAD, DEV changes, native build, final tests/performance and anything remaining. Do not proceed to another large phase without the owner's next instruction. Current P6 status: **OPEN**. Missing current-native, client integration and rollout evidence is not supplied by this measurement package.

## Control / next action

The existing redovi.json B04/B05 and root finalization carry the result and stop instruction; the existing generator must run before its views are committed. No second tracker, hosted dashboard replacement or false phone light is created. Hosted publication remains unverified. Next: use the authorized-scan/control findings to choose the smallest safe performance repair or a specifically scoped authority candidate, then complete wider distributions/capacity/load evidence and the planned paging/map/locality client work. Protected live application and device acceptance remain separate; no priority change or next-phase work is authorized here.

Method references: PostgreSQL17 row security and EXPLAIN documentation (https://www.postgresql.org/docs/17/ddl-rowsecurity.html ; https://www.postgresql.org/docs/17/using-explain.html). These explain measurement boundaries, not USKOČI acceptance.
