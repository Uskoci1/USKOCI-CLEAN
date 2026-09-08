# Shared discovery read foundation — 2026-09-07

Status: **SOURCE IMPLEMENTED / LOCAL SDK-TRANSPORT TESTS PASS / CONSUMER INTEGRATION AND CANONICAL REVIEW PENDING**.

Base is freshly fetched canonical `d4d8cd09bf44dd54c7355605b0c256813b46ab1b` (including D03 mobile and Windows Metro recovery). This is an additive read-contract unit, not a new backend, navigation or map implementation. No live query/write, provider call, migration, dependency change or Android proof is performed here. Earlier product/live checkpoints retain their recorded observation times.

## Contract and compatibility

`izvor.otvorenePrilikeStrana({ cursor?, limit?, signal? })` returns `{ items, nextCursor }`. Default limit is30; accepted limits are integers1..50. The request orders `created_at DESC, id DESC` and reads at most `limit + 1` rows. The extra row only establishes a next page; it is neither displayed nor enriched. Cursor timestamps preserve server microseconds. Strict complete timestamp and36-character UUID validation precede the raw PostgREST keyset expression, including trailing-newline rejection. List and Map consume the same returned IDs; a missing pin never removes an item from the list.

This is keyset traversal of currently authorized rows, not a transaction snapshot. Inserts ahead of the cursor appear after refresh; status changes may remove rows between pages. The consumer owns refresh, accumulated-page deduplication, selected-card state, account/focus invalidation and filter scope. There is no new global city/search/bounds filter or total-count claim. The legacy `otvorenePrilike()` still returns an array using its existing query limit behavior; it is not silently capped to the first30 and does not promise the entire database. `prilika(id)` keeps by-ID RLS access for authorized participants after task closure.

`supabaseIzvor` delegates all three discovery reads to `discoveryClientService`. The existing fake source implements the same page shape only inside its explicitly selected simulator. Production composition retains its existing fail-closed Supabase configuration boundary.

## Public projection and task hints

The allowlist contains public Need fields only: coarse city/area/coordinates, execution location mode, schedule kind/start/end, capacity, resource requirements, pricing, public deadline and requester profile ID. Optional identity/trust still comes exclusively from `rpc_get_public_profile`; at most4 enrichment reads run concurrently, IDs are deduplicated, returned profile IDs must match, and failure leaves neutral unavailable identity/trust. The page validates before enrichment. There are no account IDs, raw cross-account profile joins, exact addresses, sensitive rows, description/private terms or Application counts in this projection.

Schema authority is existing source: `20260829183551_clean_need_foundation.sql` declares intentionally coarse numeric coordinates and required slots1..50; `20260829210602_clean_needs_schema_completion.sql` declares execution/schedule modes; `20260830194000_clean_p2_read_layer_repair.sql` grants authenticated public discovery through PUBLISHED/SELECTION RLS and the covered-slots read; `20260829185354_clean_need_selection_completeness.sql` adds the public deadline. No new permission is inferred for anonymous browsing.

Real zero coordinates are retained. Incomplete, nonnumeric, nonfinite or out-of-range pairs produce no pin. REMOTE always has no pin. Other modes identify an approximate anchor: stationary point, route origin, first stop or area centroid according to existing server semantics. The adapter does not infer a destination, route line, exact place or geocoder result. Returned `executionLocationMode`, `scheduleKind`, `startsAt`, `endsAt` and `grad` let the consumer present these distinctions.

Missing, fractional, negative or otherwise invalid capacity fails the read; there is no fabricated1 or implicit empty slot. Actual covered count survives overcoverage; only the visual fraction is clamped to0..1. The accepted PR64 field names `primaNovePrijave` and `rokZaPrijaveIso` are preserved: public status/capacity/deadline form a task-level display hint, not Worker eligibility or permission to submit. Deadlines are validated and rechecked after enrichment; the consumer must also recheck time before an action and the RPC remains authoritative. Read errors propagate; a missing detail remains null. PR64 screen/Android acceptance is a separate integration boundary.

## Cancellation and verification

The optional signal reaches the real SDK query. Checks before and after asynchronous work reject stale responses even when transport ignores abort. Pending optional profile enrichment stops waiting immediately on abort, prevents further scheduling, and cannot publish a later result; the old public-profile RPC itself has no cancellation parameter. There is no shared result cache or new Auth/navigation authority in the service.

- Final full Jest: **55 suites /511 tests PASS**, including42 new discovery tests, the existing3 opportunity-read cases, and the updated4-case public-profile boundary suite.
- TypeScript: **PASS**. Migration integrity: **87 files /87 recorded live snapshot /0 pending PASS**; this is the unchanged recorded provenance, not a fresh live observation.
- Client AST: **69 source files /26 presentation files /0 findings**. This static check is accompanied by bounded manual service/schema review; it is not a complete security proof.
- The42 new tests use the installed Supabase SDK and controlled HTTP responses. They cover actual GET/select/filter/order/limit/signal serialization, timestamp ties/microseconds, malformed cursor/page limits, missing/error/empty/recovery, safe coordinates, capacity, public-field exclusion, detail cutoff, bounded/deduplicated enrichment, mismatched profile IDs and immediate/late cancellation.
- No actual Postgres pagination runtime, new RLS admission, native Map/List parity, viewport behavior, physical Android or release claim is added. The coordinating root must bind consumers, reconcile accepted PR64 and perform the appropriate integrated proof before merge.

Evidence: `evidence/shared-discovery-20260907/validation.json` and `client-boundary.json`. The first full run found one stale static test expecting the extracted reader in its old file; its new-owner assertion keeps the privacy prohibitions. Final complete rerun passed. Peer review found the terminal-newline cursor edge and delayed enrichment cancellation; both were corrected before that final run.
