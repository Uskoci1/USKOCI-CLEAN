# Round53 — bounded optional overlays and quarantined server MAP seam

## Problem / product decision

P6 PAGE owns marketplace membership, but TaskCard may optionally show account relation, public requester identity/rating and server-owned HITNO. Those reads must never become an unbounded N+1 layer or let a late old slice decorate a newer list. MAP already returns bounded TASK/PLACE/CLUSTER buckets and must not be converted into fabricated TaskCards.

## Implementation

Added discoveryV1OverlayOwner.ts. One admitted visible slice is capped at 100 Need rows. Relations use one bounded existing relation read; public profiles are deduplicated and capped at four concurrent reads; urgency uses the existing authoritative urgency reader. Generation/account/focus fencing remains authoritative even if transport ignores abort. Optional overlay failure never removes PAGE rows: relation becomes UNKNOWN, profile/trust stays unavailable, urgency is absent. Avatar storage paths are never copied into task projections.

Added an unreachable DiscoveryV1ServerMarkerLayer using the existing native PillAnnotation primitive. It consumes at most 256 decoded P6 MAP buckets directly. TASK, PLACE and CLUSTER retain server meanings; aggregate buckets have only count/geometry and never task-card identity. The layer does not re-cluster server buckets and is not imported by DiscoveryMap, DiscoveryPresentation or app routes yet.

## Checks / exact source

Tested commit fc385a67b7ae195a04554aed8587b7642503072f; Actions run 36491627955. TypeScript PASS. Focused overlay+marker seam: 2 suites / 9 tests PASS. Existing P6/Discovery regressions: 7 suites / 210 tests PASS. Full Jest: 353 suites / 7347 tests PASS.

## Preserved first failure

The first Round53 attempt, source 982a768082a2cb3dd3d16fa944e079e4530da89a / run36491107610, passed TypeScript and all six overlay-owner tests but the marker-layer suite failed before running assertions because Jest rejected an out-of-scope React reference in the mock factory. The workflow failed and published no control/evidence commit. ROUND_53_FAIL_36491107610.json preserves that disposition and artifact id/digest. The repair changed only the test mock factory scope. The second attempt, source40361f2f / run36491390975, then exposed a React19 test-renderer contract problem: all six overlay tests passed, while three marker component assertions ran without an act-mounted renderer and failed. ROUND_53_FAIL_36491390975.json preserves that result and artifact digest. The final repair moves marker shape/bound validation into a pure projection seam used by the native layer, so its semantics are testable without pretending a native map mount occurred.

## Limits / next action

No production route uses the overlay owner, P6 transport or server marker layer. Server candidate is not applied to canonical DEV. This is source/CI only, not native map acceptance. FULL-return, scroll/viewport/selection restoration under the new reader, large-data memory/ANR, rollout and stable cross-environment performance remain open.

P6 remains OPEN. Continue P6 only. Next is the quarantined DiscoveryPresentation integration seam: current list/peek components must consume session+overlay state and the map must host the server marker layer without enabling the production route. Stop only at the owner-defined complete P6 and report P6 ZAVRŠEN.
