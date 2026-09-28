# Round48 — lazy locality work, full text parity and normalized dependency comparison

## Problem / cause / product decision

The original P6 candidate computed display locality for every public Need before filtering, even when a query was already satisfied by its title or no locality consumer existed. Round46/47 measurement showed that bounded output alone did not establish acceptable query cost. Preserve the original public payload, authorization, filter and counting semantics while avoiding unnecessary projection work.

## Implementation

New source-only delta supabase/candidates/p6_discovery_cost_v3.sql layers on the exact original plus cost_v2 and checks the preceding RPC body MD5 008c92e33b8edfbe3cc7b5263b99dac8. It changes only the proposed P6 RPC, not covered_slots, policies, grants, closure certificates or other canonical authority. Locality is still computed for PLACES, an active locality filter, or a text search not already satisfied by the title. The full original concatenated title/locality/capability substring search remains as fallback, including matches crossing field boundaries. No new native dependency or production reader call is added.

## Exact functional and measured proof

Source 0fe9e47c8e2f51fffd9d3943e6329c056c591851; Actions run 36458016326. Original candidate bytes and both deltas are hash-bound. Thirteen SQL groups pass, including the original eleven groups, helper/filter/capacity parity and paired measurement. Explicit date ranges are checked separately and cannot enter the no-date fast path. Twenty additional PAGE/MAP text comparisons cover title, locality-only, title/locality boundary, wildcard literals, Serbian and Greek/Polish characters, remote labels, tool-only matching and empty text; two active locality-filter comparisons and an EXACT recheck accompany them.

Every measured response equals its original full payload after removing only observation timestamps and using a shared legitimate anchor. Both variants use the same synthetic actors, rows and current authorization in one transaction. 240 timed calls: 30 before and 30 after for each mode, alternating order, following five warmups per variant and mode. Original and optimized plans are not used as substitutes for measured duration.

| Mode | Before + after n | Original p95 ms | Latest p95 ms | Latest max ms | SQL <=1000ms screening |
| --- | --- | --- | --- | --- | --- |
| PAGE | 30 + 30 | 770.152 | 651.55 | 658.345 | PASS |
| MAP | 30 + 30 | 801.197 | 629.871 | 630.731 | PASS |
| PLACES | 30 + 30 | 899.456 | 675.763 | 687.033 | PASS |
| EXACT_PUBLIC | 30 + 30 | 2.713 | 2.747 | 2.98 | PASS |

SQL screening PASS; collection-mode p95 improvement threshold: PASS. Dataset remains 4004 total / 3000 matched Need rows, including 1500 coincident points, sparse points and point-free/remote work. PostgreSQL 17.6, 4 reported CPUs, warm-cache single-connection SQL. These numbers exclude HTTP/network, authentication startup and native rendering. They do not prove concurrent production load, cold cache, all distributions, multi-person filter cost or 30000-scale readiness.

An additional PLACES-only function-cost diagnostic is unavailable because the existing local role cannot enable tracking. It runs after the 240 uninstrumented samples. It never grants a privilege or changes a canonical definition; only an already-permitted transaction-local tracking setting may be used. The retained function names/call counts/self and total times contain no user payload. One instrumented call is not a percentile, nested total time must not be summed, and inlined SQL functions are not tracked. Method: https://www.postgresql.org/docs/17/runtime-config-statistics.html .

## Current read-dependency comparison

The earlier aggregate column mismatch is retained in Round46/47 evidence. The detailed comparison identified approx_geog's deparsed expression as the difference: the local connection included extensions in search_path, so PostgreSQL printed unqualified function/type names; the DEV connection did not. This package sets search_path=public only inside the local read transaction and repeats the original fingerprint method without modifying schema or the stored observation.

Normalized comparison of eleven function bodies and columns/policies/indexes on seven read-dependency tables: MATCH. Individual Need-column comparison: 41 MATCH. This closes only those observed metadata dimensions, not current entire ledger/certificate/runtime/old-device acceptance. Catalog details and difference arrays are retained. DEV still has the known pending PKG045b compatible-device rollout condition; neither045b nor P6 is applied by this package.

## Backend / checks / limits / control

Original unchanged-authority/ACL/policy/certificate assertions and transaction rollback pass; stack teardown without backup passes. No real user data, provider, payment, push flag, live ledger, Android/iOS binary or visual surface is changed. The exact optimized stack also passes eleven real local Auth/PostgREST/current-decoder groups through three separate password sessions (47 local HTTP requests). The frozen Round45 harness is reused via a hash-bound additive-stack wrapper, not altered retroactively; its generated bytes are bound in the new receipt. Candidate functions are removed and existing authority fingerprints match afterward. This is local Auth, not email-provider/signup proof. This is not a fresh full Jest/native result and not release readiness.

Existing B04/B05 rows and generated control outputs are updated through node scripts/control/osvezi.mjs. Hosted publication is unverified. P6 stays OPEN. Next: distribution/capacity/load budgets and current rollout compatibility, then paging ownership/stale fences/map/locality adapters and exact native acceptance. Any live package still requires fresh canonical preconditions and the established authorization procedure.
