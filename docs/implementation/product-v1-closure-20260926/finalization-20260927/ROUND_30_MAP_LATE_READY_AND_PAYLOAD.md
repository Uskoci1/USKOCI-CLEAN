# Discovery late map readiness and stable public payload

Status: source correction; acceptance on a later exact APK is still required. The installed `baa32832` APK does not contain this correction.

## Reproduced failure

Root observed the exact `baa32832` APK on emulator `5556`: `map-mounted` at elapsed 1,636 ms (23:32:47.102), `deadline` at 16,756 ms (23:33:02.222), then both `frame-fully` and `map-loaded` at 19,139 ms (23:33:04.605). The `r30-late-map-error` screenshot/XML retained the failure overlay despite completion of the same native instance.

The client previously treated its 15-second display deadline as terminal. It now distinguishes that deadline from an explicit native error. An actual successful load of the still-current map dismisses the deadline notice without remounting. A fully rendered frame alone does not establish readiness. Native errors remain terminal; retry, account, blur and unmount retirement still reject callbacks from the old instance. Camera, selection, public point precision and animation behavior are unchanged.

## Related consumers: source inference, not device reproduction

The same deadline-versus-error refusal exists in `ResolvedPinMap` and `LocationOverviewMap`. Their narrow correction follows the same rule. The overview now keeps its owned native map behind the deadline notice instead of unmounting it, permitting that instance to finish. Actual native errors still remove the overview map. Pin-image failure, drag cancellation, point/scope ownership, account/foreground/focus and private access guards remain intact. These consumers were inspected and tested from source; their late-load cases have not been reproduced or accepted on a device.

## Repeated serialization

Discovery already memoized both its public GeoJSON object and an identical JSON fingerprint. It now supplies that existing string to `GeoJSONSource`. The installed SDK passes strings through (`GeoJSONSource.tsx:235`); its Android manager identifies JSON beginning with `{` and calls `setGeoJson` (`MLRNGeoJSONSourceManager.kt:43-46`). Previously new source children/callback props caused another complete serialization during pin renders.

The change removes this repeated JavaScript work. It does **not** establish improved native latency, tile-load time or provider availability.

## Verification

Focused checks cover identical encoded IDs/coarse geometry, one collection encoding across two pin selections, selection preservation, same-instance late recovery, frame-only refusal, real native-error refusal, and stale callbacks after all four retirement paths. Existing pin/privacy/ownership checks consume the same decoded payload. No backend, dependency, build, device action or commit is part of this patch.

Final focused results: `discovery-map.test.tsx` **40 PASS**, `discovery-map-pills.test.tsx` **50 PASS**, `ResolvedPinMap/__tests__/renderer.test.tsx` **30 PASS**, and `LocationOverviewMap.test.tsx` **23 PASS**: four distinct suites, **143 passing tests**. Scoped `git diff --check` passes.

The first Discovery run exposed a new expected-fixture omission of existing GeoJSON feature IDs, corrected without changing production payloads. The first related-consumer run caught a render-state issue: a native error after the deadline must change the overview's render state to remove its map. The overview now has a distinct `deadline` state. Only the affected suites were rerun. No native latency improvement is claimed; consolidated TypeScript and a later exact APK remain root-owned verification.
