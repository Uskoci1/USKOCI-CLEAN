# Round51 — P6 view adapter and independent point-members paging

## Product / implementation

The current Discovery view carries search, price, work mode, people, date range, selected locality, map area and a chosen public point. Round51 defines one pure adapter from that existing state into the strict P6 filter and PAGE scope. Remote intent clears geographic scope; dates are one Kada choice and override a stale quick-date word; pinPlace owns POINT_LIST ahead of an area; malformed point state refuses instead of silently widening the market. POINT_MEMBERS is a separate scope for a selected shared map point.

The strict V1 task row maps into the current Prilika/TaskCard facts without inventing requester identity, rating, avatar or urgency. Those remain optional bounded enrichments for displayed IDs only. The adapter exports a <=100 enrichment target boundary and aggregate MAP markers: PLACE/CLUSTER never become fabricated TaskCards.

The Round50 owner now has an independent POINT_MEMBERS state/channel with its own sequence, AbortController and cursor flight. Opening a shared public point therefore cannot replace or repurpose the main PAGE list. A newer chosen point fences an older member response even when abort is ignored. Scope/filter retirement also retires member paging.

## Checks / exact source

Tested commit e457ca73bad334de963b3d822f274a15cec87b48; Actions run 36485542213. TypeScript PASS. Focused adapter+owner 2 suites / 25 tests PASS; existing Discovery/map/view regressions 4 suites / 117 tests PASS; full Jest 349 suites / 7324 tests PASS. rpc_discovery_v1 remains absent from app routes, supabaseIzvor and ports.

## Limits / next action

This is a production-shaped adapter contract, not production wiring. Current DiscoveryPresentation and DiscoveryMap still consume the old full task collection. Server MAP buckets are represented truthfully, but the map UI has not yet been converted to consume them. Profile/relation/urgency overlays still need bounded displayed-ID integration. Server rollout, broader performance/load, FULL-return after new reader wiring and exact native memory/ANR evidence remain open.

P6 remains OPEN and the owner stop condition is unchanged. Next: build the quarantined screen integration around this adapter and Round50 owner, including bounded enrichment and server MAP/PLACES state, while the production switch stays off until rollout/performance/native gates permit it.
