# Round50 — P6 paging owner and stale-response fencing core

## Problem / product decision

P6 cannot be wired merely because its decoders and SQL pass. A slow older PAGE/MAP/PLACES/EXACT response must never overwrite a newer filter, map move, scope, account or focus. One cursor must have one paging owner, and continuation must stay bound to the accepted anchor.

## Implementation

Added `src/data/discoveryV1Owner.ts` as a pure source owner over the existing strict PAGE/EXACT/MAP/PLACES decoders. It owns request epochs, per-channel sequences and AbortControllers; generation/account/focus fencing remains authoritative even when transport ignores abort. Filter/scope inputs are copied before IO. PAGE first response owns the PAGE/MAP anchor; MAP cannot run before that anchor. Scope changes keep the browsing anchor but retire the old list traversal. A cursor has one coalesced next request; cross-page task IDs are deduplicated. PLACES has its own prefix/facet-bound chain and cursor owner. Retire is terminal and clears snapshots.

This module does not call Supabase, does not replace the current route, and does not make a production-reader claim. The current full-collection reader remains active until server/performance/native gates permit an explicit wiring package.

## Checks / exact source

Tested commit `5d8f6461fe10a58c53e636d7b9ff2c895a0b46fe`; Actions run `36484218203`. TypeScript PASS. Focused owner: 1 suite / 12 tests PASS. Existing PAGE/MAP/PLACES wire contracts: 2 suites / 31 tests PASS. Full Jest: 348 suites / 7311 tests PASS. Production grep confirms `rpc_discovery_v1` is still absent from `src/app`, `src/data/supabaseIzvor.ts` and `src/data/ports.ts`.

Tests explicitly make old promises resolve after their AbortSignal was set, then require STALE with no publication. They cover filter replacement, two map requests, scope change during next-page IO, duplicate next-page calls, cross-page UUID dedupe, anchor drift refusal, locality query replacement and paging context, account/focus invalidation, terminal retire, latest-only EXACT and caller-object mutation after request start.

## Limits / next action

This closes the reusable client ownership/fencing core only. It does not yet connect PAGE/MAP/PLACES/EXACT_PUBLIC to the production route, make map/list/filter a real server-backed surface, prove FULL-return after that integration, provide large-data memory/ANR evidence, or authorize/apply the server package. Round49 performance limitations also remain.

P6 remains **OPEN**. Continue P6 only. Next is the bounded adapter/integration package: map/list/filter state must feed this owner, current UI state preservation must survive its paging model, and production switching stays disabled until server rollout/performance gates are satisfied. Do not move to another major phase. When every P6 condition is actually closed, stop and report **P6 ZAVRŠEN** to the owner.
