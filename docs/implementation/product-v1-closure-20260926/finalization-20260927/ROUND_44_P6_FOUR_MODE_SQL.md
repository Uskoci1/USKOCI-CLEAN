# Round44 — four-mode P6 disposable SQL candidate

## Problem / user impact

The source-only candidate previously implemented PAGE and EXACT_PUBLIC, while MAP and PLACES only had strict client decoders. Paging one list page cannot substitute for complete spatial coverage or complete locality suggestions. The production reader remains unchanged.

## Product / contract decisions

PAGE/EXACT retain the existing predicates, public projection, microsecond keyset and capacity authority. MAP adds required bounds and grid (integer 1–24), reduces a world-anchored grid until the entire coverage fits at most 256 cells, groups every qualifying public point, and emits TASK / coincident PLACE / CLUSTER. A representative is a real newest public member point, never private coordinates or a fabricated centroid. Wrapped/equal/world-edge coverage is explicit; point-free/remote rows affect counts, never spatial membership.

PLACES adds required prefix, facetArea (bounds or null), limit 1–30 and after (null or count+text+key). Incoming task text/selected locality are deliberately removed from facet predicates. Other work/time/price/capacity filters remain. Prefix is literal normalized substring, not SQL wildcard search. Every sort component participates in the keyset. Serbian display collation is followed by the normalized key. The PLACES anchor additionally binds prefix and facetArea; changing either starts a new paging sequence. Counts are exact-live, not a frozen marketplace snapshot.

## Implementation / files

Standalone candidate: supabase/candidates/p6_discovery_all.sql. Standalone proof and runner: supabase/proofs/discovery/p6_discovery_all_proof.sql and p6_discovery_all_run.mjs. The bounded builder pins and preserves the previous candidate/proof/runner, writes separate reviewable files, and commits them before execution. Existing frozen migrations, authority functions, ACL/RLS, certificates and old failure evidence are untouched.

## Checks / exact source

Tested source 7b75631ba0504c3ca9d6a0a43887bb88180572c9; Actions run 36443089843; 11 SQL groups PASS. The 208 vectors execute current client text/time/filter semantics. The original 1004-row PAGE/EXACT traversal remains covered. Additional MAP datasets 0/1/100/1000/3000 include 1500 coincident tasks, sparse points, 50 on-site point-free tasks and 50 remote tasks. The complete locality set is traversed three entries at a time with count/text/key order and no duplicates or omissions. Authenticated SQL role, anon/auth-null refusal, unchanged existing authority and transaction rollback checks remain. Exact source hashes and narrower proof flags are in the JSON receipt.

These are functional SQL proofs on the historical disposable PKG045b predecessor. They are not actual Auth/PostgREST, live latest-DEV compatibility, internal query-cost measurements, native speed/memory or release acceptance. The known client protocol checks remain quarantined. A functional 3000-row pass does not prove readiness for 30000 users/tasks or concurrent production traffic.

## Backend / application / rollback

No DEV/Edge/provider call or live mutation is performed by this package. The generated candidate requires the explicit disposable marker and postgres; it is not a canonical deployment migration. SQL changes and synthetic fixtures roll back together, and the isolated stack is stopped without retaining it. A later live package still requires fresh definitions/ACL/certificate preconditions, complete boundary/performance proof, specific authorization where required, canonical apply/readback and ledger receipt. No fake ledger row is created.

## Control / publication / status / next action

B04/B05 are updated and the existing generator must run before committing its output. Hosted control publication is not proven. Status: FOUR-MODE SQL CANDIDATE PROVEN ON DISPOSABLE HISTORICAL BASELINE; NOT APPLIED; NOT WIRED; P6 OPEN.

Next: complete real Auth/PostgREST and current-predecessor compatibility, internal EXPLAIN ANALYZE BUFFERS with measured datasets and budgets, stale-request/paging ownership and map/locality adapters. Then an exact Android/iOS large-data checkpoint. No owner approval is needed merely to prepare those proofs; live apply, new native dependencies and paid providers remain separate boundaries.
