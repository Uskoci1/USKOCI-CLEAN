# Round55 — authoritative search/facet preview and quarantined route coordinator

## Problem / product decision

A bounded PAGE cannot answer the search panel by counting its loaded rows or deriving locality suggestions from only those rows. Also, the real Discovery presentation needs one route owner that distinguishes a server-search intent from passive UI memory: viewport, sheet height and list offset must not restart PAGE/MAP, while applying a new search must.

## Implementation

Added discoveryV1SearchOwner.ts. One generation owns an exact PAGE limit-1 count preview plus an independent PLACES facet read. PAGE supplies exact listed/undated counts and whole-collection availability. PLACES supplies locality rows, Everywhere and map-area counts under the non-geographic conditions, with count/text/key continuation. A newer draft aborts and fences both reads; ignored abort cannot publish. PLACES failure does not fabricate zero or disable a separately authoritative PAGE count. Remote preview sends no locality request.

DiscoverySearchPanel now has an optional P6 seam. While present it never falls back to the bounded loaded rows for count, locality facets or availability. A stale preview says loading. The selected locality remains removable even if a live facet refresh no longer returns it, and PLACES continuation is explicit. Legacy search behavior is unchanged without the seam.

Added discoveryV1RouteCoordinator.ts. Its server-intent key contains the normalized P6 filter and PAGE scope only. Viewport, sheet and listOffset are passive route memory and do not reopen the traversal. Search/filter changes do reopen; settled map bounds use the existing shared anchor; TASK selection uses EXACT_PUBLIC; paging refreshes only a capped optional overlay slice. Search preview is independent from displayed PAGE membership. The coordinator snapshot feeds the existing Round54 presentation bridge, including the server search seam.

Round53 overlay application now admits a bounded metadata slice without rejecting a longer accumulated PAGE traversal: exact item id/revision/profile/urgent fingerprints decide which rows may receive metadata; all other rows remain valid base task rows with UNKNOWN/unavailable overlays. Membership is still P6 PAGE authority.

## Checks / exact source

Tested commit af0d14bcfd65f0f6d01d595c45cc9a8fdfa0b9dc; Actions run 36521748674. TypeScript PASS. Focused search owner/coordinator/overlay/search-panel/bridge suites: 5 suites / 63 tests PASS. Existing P6 + Discovery regressions: 9 suites / 258 tests PASS. Full Jest: 356 suites / 7370 tests PASS.

Focused checks prove exact server count can be 37 while one local row is loaded; stale preview never falls back to local count; locality failure leaves PAGE count usable; PLACES continuation keeps prefix/facetArea/cursor and deduplicates; remote sends one PAGE only; newer drafts fence older reads; viewport/sheet/offset create no transport calls; a search intent creates a new PAGE/MAP traversal; map-area changes retain the accepted anchor and passive viewport/offset; the bridge receives the coordinator search snapshot; optional metadata remains bounded after more than 100 PAGE rows.

## Limits / next action

This remains an unreachable source/CI route coordinator. src/app still imports neither the coordinator nor the P6 bridge, and rpc_discovery_v1 remains absent from app routes/Izvor/ports. Canonical DEV has not received the P6 server package. No Android/iOS build is evidence for this source. Stable cross-environment performance, wider load/capacity distributions, server rollout, actual production reader switch, FULL-return on that switch and native memory/ANR acceptance remain open.

P6 remains OPEN. Continue P6 only. Next: freeze a deployable combined P6 server package from the proved original+cost deltas, refresh current DEV/certificate/ACL preconditions and larger/distribution performance proof without applying it; in parallel prepare the guarded route switch/native checkpoint contract. Stop only when the full owner-defined P6 condition is satisfied and report P6 ZAVRŠEN.
