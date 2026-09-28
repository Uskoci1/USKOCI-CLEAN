# Round52 — quarantined P6 screen session and exact RPC transport

## Product / implementation

A production-shaped but unreachable screen session now binds MarketplaceView, the Round50 owner and Round51 adapters into one state owner. Initial open is PAGE then MAP on the accepted anchor. A settled map move changes PAGE AREA scope and MAP coverage under that same browsing anchor. POINT_LIST changes only the list scope. PAGE and PLACES paging remain independent. TASK pins resolve EXACT_PUBLIC before a Peek exists; PLACE pins read a separate POINT_MEMBERS page; CLUSTER is only navigation geometry and cannot fabricate a task card. Cross-kind pin selection has its own sequence fence, so a late PLACE read cannot overwrite a newer TASK selection.

The new DiscoveryV1 client transport sends exactly one rpc_discovery_v1 call per owner request, passes AbortSignal when supported, checks abort again after a transport that ignores it, never retries an unknown read, and converts provider diagnostics to stable client errors. It is deliberately not exported through Izvor, supabaseIzvor or any app route.

## Checks / exact source

Tested commit 7e9520bfd9aef8c4ec2aa61a29a035c187508d58; Actions run 36487046625. TypeScript PASS. Focused transport/session/owner/adapter 4 suites / 39 tests PASS; existing Discovery regressions 5 suites / 257 tests PASS; full Jest 351 suites / 7338 tests PASS. The quarantine guard proves app routes, supabaseIzvor and ports still contain no rpc_discovery_v1 while the dedicated transport does.

## Limits / next action

This is not production wiring and does not close map/list/filter native acceptance. The current DiscoveryPresentation still renders the legacy full collection and builds pins from task rows. Optional public-profile, relation and urgency overlays need a bounded session owner; the server MAP marker path still needs a quarantine UI seam. Server rollout, wider performance/load, FULL return after real switch and native memory/ANR evidence remain open.

P6 remains OPEN. Continue only P6. Next: add bounded overlay ownership and an unreachable server-backed presentation seam using these exact models, while keeping the route switch off until server/performance/native gates are ready.
