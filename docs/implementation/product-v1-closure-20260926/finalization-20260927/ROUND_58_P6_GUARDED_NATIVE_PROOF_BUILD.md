# Round58 — guarded native P6 proof build

## Purpose / safety boundary

This package prepares an exact Android candidate that can exercise the real Zadaci route with the P6 route coordinator after a server target is available. It does not turn P6 on for ordinary users. The switch requires three things simultaneously: route parameter p6Proof=1, compile-time EXPO_PUBLIC_P6_DISCOVERY_PROOF=1, and Android package rs.uskoci.dev. A deep link/query parameter alone cannot change readers. Publication handoff parameters always keep the separately proved legacy publication landing.

## Source integration

The proof route uses the existing Zadaci address and existing DiscoveryPresentation/Map/TaskCard/Peek surface. It instantiates the Round55 route coordinator, Round53 bounded overlays, strict P6 transport and server-owned search/facet seam. Viewport/sheet/list offset remain route memory; filter changes reopen the traversal; MAP area/POINT/EXACT/PAGE remain coordinator-owned. Detail navigation still uses the existing /potrebe/[id]/pregled or /prilike/[id] screens according to the bounded relation overlay. No new native dependency is introduced.

## Checks / build

Tested source 176dddda79f1818f5b8f728a5762277148201bf1; Actions run 36560382420. TypeScript PASS. Focused P6 native-gate/coordinator/presentation tests: 5 suites / 28 tests PASS. Full Jest: 357 suites / 7374 tests PASS. ARM64 physical-device-compatible release APK built with exact DEV package and proof compile flag: SHA256 3e933f37096a9f0e583d8a0656805e8e4c47b62ec8928f201839d03226d88de1, 71193802 bytes. The APK is a workflow artifact only; it is not published as dev-latest or a store artifact.

## Limits / next P6 action

This is a build proof, not device acceptance. The candidate was not installed or interacted with, no P6 server package was applied to canonical DEV, and normal builds remain legacy. It therefore does not prove FULL → detail → Back, preserved offset/viewport/selected pin, memory/ANR, camera/touch latency, or production reader cutover.

P6 remains OPEN. The next native action is to run this guarded reader against an admissible PKG045b+P6 server target on Android, then use the same exact source/build identity for the required repeated FULL/map/list/detail/Back and memory/ANR checkpoints. Do not advance to another major phase.
