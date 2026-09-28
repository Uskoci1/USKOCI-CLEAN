# Round54 — quarantined P6 seam through the real Discovery presentation

## Problem / decision

Round52/53 owned server state and bounded overlays, but the actual DiscoveryMap/DiscoveryPresentation still had no path for server MAP buckets, exact PAGE counts or the session-owned TASK/PLACE Peek. A separate visual prototype would not close that gap. This package adds an optional P6 seam to the existing production components while keeping every production route on the legacy reader.

## Implementation

DiscoveryMap now has an optional p6Server contract. When present, server TASK/PLACE/CLUSTER buckets are rendered through the Round53 marker layer and the legacy GeoJSONSource/native clustering/pill stack is not mounted. Geometry ownership excludes selection callbacks, so choosing a marker cannot remount the map or discard viewport. Initial server fit uses server wholeBounds only; absence of public bounds falls back to the neutral overview instead of inventing geography. Empty-map taps clear the server Peek; settled user camera moves still use the existing bounded area callback. Legacy behavior is unchanged when p6Server is absent.

DiscoveryPresentation now has an optional p6Seam. Its list rows come from the server PAGE slice rather than re-filtering membership; exact server listed/inArea/withoutPoint/undated counts drive count semantics even while only bounded pages are loaded. FlatList end-reach can request exactly the next PAGE through the owner. Session TASK/POINT_MEMBERS Peek replaces legacy inferred pin selection only in this mode. Area/show-point/show-all/clear actions are callbacks to the P6 session; no optimistic server truth is invented.

DiscoveryV1PresentationBridge maps the Round52 screen snapshot plus Round53 bounded overlays into these exact real-component props. Strict wireItems are retained in the screen snapshot solely for bounded overlay ownership; mapWholeBounds is carried separately. The bridge is deliberately unreachable from src/app.

## Checks / exact source

Tested commit 340c2b0e84790170432696b7801b24b434d65fcb; Actions run 36493289095. TypeScript PASS. Focused bridge/server-marker checks: 2 suites / 7 tests PASS. Existing P6 plus legacy Discovery map/presentation regressions: 10 suites / 311 tests PASS. Full Jest: 354 suites / 7351 tests PASS. CI also proves rpc_discovery_v1 remains absent from app routes/supabaseIzvor/ports and DiscoveryV1PresentationBridge is not imported by app routes.

## Preserved first failure

The first Round54 attempt, source 03ad62803 / run36492982087, stopped at TypeScript with TS2353/TS2339 because DiscoveryV1ScreenSnapshot did not yet expose the strict PAGE wireItems consumed by the new bridge. No focused/full tests, evidence publication or control update ran and no artifact was produced. ROUND_54_FAIL_36492982087.json preserves that result. The repair adds the already-decoded PAGE rows to the screen snapshot; it does not change server state or production route reachability.

## Limits / next action

This is still quarantine, not the production reader switch and not native acceptance. The search panel still needs authoritative server PLACES/count/availability ownership instead of deriving all choices from a bounded loaded PAGE. A route coordinator must own session reopen/filter lifecycle without turning viewport-only changes into new search sessions. Server rollout/performance, FULL-return under the new reader, large-data memory/ANR and exact device build remain open.

P6 remains OPEN. Continue only P6. Next: server-owned search/facet model plus the unreachable route coordinator around this real presentation seam; then refresh load/performance and prepare the protected rollout/native gates. Do not advance to another large phase.
